import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, Points, PointsMaterial } from "three";
import { createRenderer, type RendererHandle, type RenderBuffers, type GeometryConfig } from "../gpu/renderer";
import { createBindings } from "../wasm/ndvis";

export const SceneViewport = () => {
  return (
    <section className="scene-viewport">
      <Canvas camera={{ position: [4, 4, 4], fov: 60 }}>
        <color attach="background" args={["#0f172a"]} />
        <Suspense fallback={null}>
          <HyperScene />
        </Suspense>
        <axesHelper args={[2]} />
        <OrbitControls makeDefault />
        <ambientLight intensity={0.5} />
        <directionalLight intensity={0.75} position={[5, 5, 5]} />
      </Canvas>
    </section>
  );
};

const HyperScene = () => {
  const { gl } = useThree();
  const [renderer, setRenderer] = useState<RendererHandle | null>(null);
  const [positions3d, setPositions3d] = useState<Float32Array | null>(null);
  const geometryRef = useRef<BufferGeometry>(null);

  useEffect(() => {
    let mounted = true;

    const initRenderer = async () => {
      try {
        const wasm = await createBindings();
        const canvas = gl.domElement;
        const handle = await createRenderer(canvas, wasm);

        if (!mounted) {
          handle.dispose();
          return;
        }

        setRenderer(handle);
        console.log(`Renderer initialized: ${handle.mode}`);

        // Demo: Create a simple 4D hypercube and project it to 3D
        const dimension = 4;
        const vertexCount = 16; // 2^4 vertices

        // Generate 4D hypercube vertices (SoA layout)
        const vertices = new Float32Array(dimension * vertexCount);
        for (let i = 0; i < vertexCount; i++) {
          for (let d = 0; d < dimension; d++) {
            vertices[d * vertexCount + i] = ((i >> d) & 1) * 2 - 1; // -1 or 1
          }
        }

        // Identity rotation matrix (no rotation initially)
        const rotationMatrix = new Float32Array(dimension * dimension);
        for (let i = 0; i < dimension; i++) {
          rotationMatrix[i * dimension + i] = 1;
        }

        // Simple basis: project onto first 3 dimensions
        const basis = new Float32Array(3 * dimension);
        for (let component = 0; component < 3; component++) {
          basis[component * dimension + component] = 1;
        }

        const positions3d = new Float32Array(vertexCount * 3);

        const buffers: RenderBuffers = {
          vertices,
          rotationMatrix,
          basis,
          positions3d,
        };

        const config: GeometryConfig = {
          dimension,
          vertexCount,
        };

        // Project to 3D
        const projected = await handle.projectTo3D(buffers, config);
        if (mounted) {
          setPositions3d(projected);
        }
      } catch (error) {
        console.error("Failed to initialize renderer:", error);
      }
    };

    initRenderer();

    return () => {
      mounted = false;
      renderer?.dispose();
    };
  }, [gl]);

  useEffect(() => {
    if (positions3d && geometryRef.current) {
      // Zero-copy: directly attach the Float32Array to BufferAttribute
      geometryRef.current.setAttribute("position", new BufferAttribute(positions3d, 3));
      geometryRef.current.computeBoundingSphere();
    }
  }, [positions3d]);

  if (!positions3d) {
    return null;
  }

  return (
    <points>
      <bufferGeometry ref={geometryRef} />
      <pointsMaterial color="#38bdf8" size={0.15} />
    </points>
  );
};
