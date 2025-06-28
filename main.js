"use strict";

class PCG32 {
	constructor(seed = 3140068561n) {
		this.state = BigInt(seed);
		this.next();
	}

	next() {
		const oldState = this.state;
		const MASK = ((1n << 64n) - 1n);
		this.state = (oldState * 6364136223846793005n + 1442695040888963407n) & MASK;
		const xorshifted = Number(((oldState >> 18n) ^ oldState) >> 27n) >>> 0;
		const rotation = Number(oldState >> 59n) & 31;
		const result = (xorshifted >>> rotation) | (xorshifted << ((-rotation) & 31));
		return result >>> 0;
	}

	nextFloat(min = 0.0, max = 1.0) {
		let result = (this.next() >>> 9) / 0x800000; // divide by 2^23
		result *= max - min;
		result += min;
		return result;
	}
};

const rng = new PCG32();

const canvas = document.getElementById("canvas");

async function Init() {
	const adapter = navigator.gpu && await navigator.gpu.requestAdapter();
	if (!adapter) return;

	const device = await adapter.requestDevice();
	const context = canvas.getContext("webgpu");
	context.canvas.width = window.innerWidth;
	context.canvas.height = window.innerHeight;
	window.onresize = () => {
		context.canvas.width = window.innerWidth;
		context.canvas.height = window.innerHeight;
	}

	const format = navigator.gpu.getPreferredCanvasFormat();

	context.configure({
		device,
		format,
		alphaMode: "opaque"
	});

	const particleCount = 2000;
	const particleStride = 4 * 4; // four floats per particle
	const particleData = new Float32Array(particleCount * 4);

	for (let i = 0; i < particleCount; ++i) {
		const baseIndex = i * 4;

		// position
		particleData[baseIndex + 0] = rng.nextFloat(-1.0, 1.0);
		particleData[baseIndex + 1] = rng.nextFloat(-1.0, 1.0);

		// velocity
		const angle = rng.nextFloat(0.0, Math.PI * 2);
		particleData[baseIndex + 2] = Math.cos(angle) / 512;
		particleData[baseIndex + 3] = Math.sin(angle) / 512;
	}

	const particleBuffer = device.createBuffer({
		size: particleData.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	const range = particleBuffer.getMappedRange();
	(new Float32Array(range)).set(particleData);
	particleBuffer.unmap();

	const shaderModule = device.createShaderModule({
		code: await fetch("simulate.wgsl").then(r => r.text())
	});

	const computePipeline = device.createComputePipeline({
		layout: "auto",
		compute: {
			module: shaderModule,
			entryPoint: "main"
		}
	});

	const renderPipeline = device.createRenderPipeline({
		layout: "auto",
		vertex: {
			module: shaderModule,
			entryPoint: "vs_main"
		},
		fragment: {
			module: shaderModule,
			entryPoint: "fs_main",
			targets: [{ format }]
		},
		primitive: {
			topology: "point-list"
		}
	});

	const computeBindGroup = device.createBindGroup({
		layout: computePipeline.getBindGroupLayout(0),
		entries: [{
			binding: 0,
			resource: { buffer: particleBuffer }
		}]
	});

	const renderBindGroup = device.createBindGroup({
		layout: renderPipeline.getBindGroupLayout(1),
		entries: [{
			binding: 0,
			resource: { buffer: particleBuffer }
		}]
	});

	function updateAndRender(dt) {
		const encoder = device.createCommandEncoder();

		// update
		{
			const pass = encoder.beginComputePass();
			pass.setPipeline(computePipeline);
			pass.setBindGroup(0, computeBindGroup);
			pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
			pass.end();
		}

		// render
		{
			const view = context.getCurrentTexture().createView();
			const pass = encoder.beginRenderPass({
				colorAttachments: [{
					view,
					loadOp: "clear",
					storeOp: "store",
					clearValue: { r: 0, g: 0, b: 0, a: 0 }
				}],
			});

			pass.setPipeline(renderPipeline);
			pass.setBindGroup(1, renderBindGroup);
			pass.draw(particleCount);
			pass.end();
		}

		device.queue.submit([encoder.finish()]);
		requestAnimationFrame(updateAndRender);
	}
	requestAnimationFrame(updateAndRender);
}

Init();
