@group(0) @binding(0)
var<storage, read_write> particles: array<vec4<f32>>;

@group(1) @binding(0)
var<storage, read> particles_read: array<vec4<f32>>;

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let index = id.x;
	if (index > arrayLength(&particles)) {
		return;
	}

	var p = particles[index];
	var position = p.xy;

	var hasDeadNeighbor = false;
	if (length(p.zw) != 0.0) {
		for (var i = 0u; i < arrayLength(&particles); i += 1) {

			if (i == index) { continue; }
			var other = particles[i];

			let searchDistance = 1.0 / 128.0;
			if (distance(other.xy, position) < searchDistance && length(other.zw) == 0.0) {
				hasDeadNeighbor = true;
				break;
			}
		}
	}

	if (hasDeadNeighbor) {
		particles[index] = vec4<f32>(position, 0.0, 0.0);
	} else {
		let newPosition = position + p.zw;
		let wrapped = fract(newPosition * 0.5 + 0.5) * 2.0 - 1.0;
		particles[index] = vec4<f32>(wrapped, p.zw);
	}
}

struct VertexOut {
	@builtin(position) pos: vec4<f32>,
	@location(0) color: vec4<f32>
};

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
	let p = particles_read[index];
	let velocity = p.zw;

	var out: VertexOut;
	out.pos = vec4<f32>(p.xy, 0.0, 1.0);
	if (length(velocity) != 0.0) {
		out.color = vec4<f32>(0.0);
	} else {
		out.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);
	}
	return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
	return in.color;
}
