"""Takes both of htdemucs' DFTs out of the ONNX graph; htdemucs_runner.py does them in numpy.

Run it on the output of htdemucs_halve_segment.py, with a python that has `onnx`:

    python build/htdemucs_cut_fft.py htdemucs-halved.onnx models/htdemucs.onnx

Why: the iSTFT's DFT has `inverse` and `onesided` both set, which onnxruntime rejects at shape
inference before 1.25 - and 1.25 is where the Intel Mac wheel stops existing. So the model could not
run on an Intel Mac at all. Out of the graph, any onnxruntime loads it. It is also faster everywhere:
numpy's real FFT beats ORT's DFT op, 4.9s -> 4.2s for a 30s window on onnxruntime 1.29 (M4, four
threads), against the stems the uncut model gives at 123 dB SNR, 6e-7 worst sample - float rounding.

What moves, on each side of the network:

    in   mix [1, C, L] -> reflect pad 3/2 hop, reflect pad n/2, frames of n at hop n/4, window, DFT
         becomes a second input:  mix_spec [C*F, n/2+1, 2]   (`mix` stays: the time branch reads it)
    out  inverse DFT, window, overlap-add, centre trim, normaliser, 3/2-hop trim, + time branch
         becomes two outputs:     stems_spec [S*C*F, n/2+1, 2]   stems_time [1, S, C, L]

The runner tells the models apart by their inputs and outputs, so it runs this one and the uncut one.
Every constant the removed ops held (both windows, the normaliser) is a function of n and F, which the
runner reads off these shapes; the runner's versions match the graph's to 4e-8.
"""
import sys
import onnx
from onnx import helper

SRC, DST = sys.argv[1], sys.argv[2]
m = onnx.shape_inference.infer_shapes(onnx.load(SRC))
g = m.graph
assert [o.name for o in g.output] == ['stems'] and [i.name for i in g.input] == ['mix'], 'not the uncut model'


def attrs(n):
    return {a.name: helper.get_attribute_value(a) for a in n.attribute}


dfts = [n for n in g.node if n.op_type == 'DFT']
inv = [n for n in dfts if attrs(n).get('inverse') == 1]
fwd = [n for n in dfts if attrs(n).get('inverse', 0) == 0]
assert len(inv) == 1 and len(fwd) == 1, f'{len(inv)} inverse and {len(fwd)} forward DFTs'
inv, fwd = inv[0], fwd[0]
shapes = {v.name: [d.dim_value for d in v.type.tensor_type.shape.dim] for v in g.value_info}

# out: everything downstream of the inverse DFT, which must end at the Add that makes `stems`
dead = {inv.output[0]}
tail = [inv]
for n in g.node:
    if any(i in dead for i in n.input):
        dead.update(n.output)
        tail.append(n)
final = tail[-1]
assert final.op_type == 'Add' and list(final.output) == ['stems'], (final.op_type, list(final.output))
time_branch = [i for i in final.input if i not in dead]
assert len(time_branch) == 1, list(final.input)

# in: the forward DFT and every ancestor that feeds nothing else
head = [fwd]
grew = True
while grew:
    grew = False
    gone = set(map(id, head + tail))
    read = {i for n in g.node if id(n) not in gone for i in n.input}
    producer = {o: n for n in g.node for o in n.output}
    for n in list(head):
        for i in n.input:
            p = producer.get(i)
            if p is not None and id(p) not in gone and not set(p.output) & read:
                head.append(p)
                grew = True
                gone.add(id(p))

spec_shape = shapes[fwd.output[0]]
for n in head + tail:
    g.node.remove(n)
for n in g.node:
    for k, i in enumerate(n.input):
        if i == fwd.output[0]:
            n.input[k] = 'mix_spec'
        assert n.input[k] not in dead, f'{n.name} reads {i}, which the cut removed'
g.node.extend([
    helper.make_node('Identity', [inv.input[0]], ['stems_spec'], name='stems_spec'),
    helper.make_node('Identity', [time_branch[0]], ['stems_time'], name='stems_time'),
])
g.input.append(helper.make_tensor_value_info('mix_spec', onnx.TensorProto.FLOAT, spec_shape))
del g.output[:]
g.output.extend([helper.make_tensor_value_info('stems_spec', onnx.TensorProto.FLOAT, shapes[inv.input[0]]),
                 helper.make_tensor_value_info('stems_time', onnx.TensorProto.FLOAT, shapes[time_branch[0]])])
read = {i for n in g.node for i in n.input}
keep = [t for t in g.initializer if t.name in read]
print(f'removed {len(head)} nodes before the network and {len(tail)} after, {len(g.initializer) - len(keep)} initializers')
del g.initializer[:]
g.initializer.extend(keep)
del g.value_info[:]

m = onnx.shape_inference.infer_shapes(m, strict_mode=True)
onnx.checker.check_model(m, full_check=True)
assert not any(n.op_type == 'DFT' for n in m.graph.node)
onnx.save(m, DST)
dims = lambda vs: {v.name: [d.dim_value for d in v.type.tensor_type.shape.dim] for v in vs}
print('inputs', dims(m.graph.input), 'outputs', dims(m.graph.output))
