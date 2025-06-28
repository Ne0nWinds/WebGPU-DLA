@group(0) @binding(0)
var<storage, read_write> particles: array<vec4<f32>>;

@group(1) @binding(0)
var<storage, read> particles_read: array<vec4<f32>>;

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let i = id.x;
	if (i > arrayLength(&particles)) {
		return;
	}

	var p = particles[i];
	p.x += p.z;
	p.y += p.w;
	particles[i] = p;
}

struct VertexOut {
	@builtin(position) pos: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
	let p = particles_read[index];
	var out: VertexOut;
	out.pos = vec4<f32>(p.xy, 0.0, 1.0);
	return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
	return vec4<f32>(1.0);
}
