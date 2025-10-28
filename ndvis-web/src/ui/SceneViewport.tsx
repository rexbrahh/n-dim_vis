import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { BufferGeometry, BufferAttribute } from "three";

import { useAppState } from "@/state/appState";
import { createRenderer, type GeometryConfig, type RenderBuffers, type RendererHandle } from "@/gpu/renderer";
import { createBindings } from "@/wasm/ndvis";

export const SceneViewport = () => {
  const overlays = useAppState((state) => state.overlays);
  const computeStatus = useAppState((state) => state.computeStatus);
  const hyperplane = useAppState((state) => state.hyperplane);
  const calculus = useAppState((state) => state.calculus);

  return (
    <section className="scene-viewport">
      <Canvas camera={{ position: [4, 4, 4], fov: 60 }}>
        <color attach="background" args={["#0f172a"]} />
        <Suspense fallback={null}>
          <HyperScene
            overlays={overlays}
            hyperplaneEnabled={hyperplane.enabled && hyperplane.showIntersection}
            calculusConfig={calculus}
          />
        </Suspense>
        <axesHelper args={[2]} />
        <OrbitControls makeDefault />
      </Canvas>
      <ComputeStatusOverlay status={computeStatus} />
    </section>
  );
};

type HyperSceneProps = {
  overlays: {
    sliceGeometry: Float32Array | null;
    levelSetCurves: Float32Array[] | null;
    gradientVectors: Float32Array | null;
    tangentPatch: Float32Array | null;
  };
  hyperplaneEnabled: boolean;
  calculusConfig: {
    showGradient: boolean;
    showLevelSets: boolean;
    showTangentPlane: boolean;
  };
};

const HyperScene = ({ overlays, hyperplaneEnabled, calculusConfig }: HyperSceneProps) => {
  const { gl } = useThree();
  const dimension = useAppState((state) => state.dimension);
  const geometry = useAppState((state) => state.geometry);

  const [renderer, setRenderer] = useState<RendererHandle | null>(null);
  const [positions3d, setPositions3d] = useState<Float32Array | null>(null);
  const geometryRef = useRef<BufferGeometry>(null);

  // Mirror projected positions from geometry cache for immediate display
  useEffect(() => {
    setPositions3d(geometry.projectedPositions);
  }, [geometry.projectedPositions]);

  // Initialise renderer once
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const wasm = await createBindings();
        const handle = await createRenderer(gl.domElement, wasm);
        if (!mounted) {
          handle.dispose();
          return;
        }
        setRenderer(handle);
      } catch (error) {
        console.error("Failed to initialise renderer", error);
      }
    })();

    return () => {
      mounted = false;
      setRenderer((prev) => {
        prev?.dispose();
        return null;
      });
    };
  }, [gl]);

  // Project geometry whenever source data or renderer changes
  useEffect(() => {
    if (!renderer) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const buffers: RenderBuffers = {
          vertices: geometry.vertices,
          rotationMatrix: geometry.rotationMatrix,
          basis: geometry.basis,
          positions3d: new Float32Array(geometry.vertexCount * 3),
          edges: geometry.edges,
        };

        const config: GeometryConfig = {
          dimension,
          vertexCount: geometry.vertexCount,
          edgeCount: geometry.edgeCount,
        };

        const projected = await renderer.projectTo3D(buffers, config);
        if (!cancelled) {
          setPositions3d(projected);
        }
      } catch (error) {
        console.error("Failed to project geometry", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [renderer, geometry, dimension]);

  useEffect(() => {
    if (positions3d && geometryRef.current) {
      geometryRef.current.setAttribute("position", new BufferAttribute(positions3d, 3));
      geometryRef.current.computeBoundingSphere();
    }
  }, [positions3d]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.75} position={[5, 5, 5]} />

      {positions3d && (
        <points>
          <bufferGeometry ref={geometryRef} />
          <pointsMaterial color="#38bdf8" size={0.15} />
        </points>
      )}

      <OverlayRenderer
        overlays={overlays}
        hyperplaneEnabled={hyperplaneEnabled}
        calculusConfig={calculusConfig}
      />
    </>
  );
};

const OverlayRenderer = ({ overlays, hyperplaneEnabled, calculusConfig }: HyperSceneProps) => {
  return (
    <group name="overlays">
      {hyperplaneEnabled && overlays.sliceGeometry && (
        <line name="hyperplane-slice">
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlays.sliceGeometry, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#ff8800" />
        </line>
      )}

      {calculusConfig.showLevelSets && overlays.levelSetCurves && (
        <group name="level-sets">
          {overlays.levelSetCurves.map((curve, index) => (
            <line key={index}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[curve, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#10b981" />
            </line>
          ))}
        </group>
      )}

      {calculusConfig.showGradient && overlays.gradientVectors && (
        <line name="gradient-vectors">
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlays.gradientVectors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#f59e0b" />
        </line>
      )}

      {calculusConfig.showTangentPlane && overlays.tangentPatch && (
        <mesh name="tangent-plane">
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlays.tangentPatch, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color="#8b5cf6" opacity={0.4} transparent side={2} />
        </mesh>
      )}
    </group>
  );
};

type ComputeStatusOverlayProps = {
  status: {
    isComputing: boolean;
    lastError: string | null;
    lastComputeTime: number;
  };
};

const ComputeStatusOverlay = ({ status }: ComputeStatusOverlayProps) => {
  if (!status.isComputing && !status.lastError) {
    return null;
  }

  return (
    <div className="compute-status-overlay">
      {status.isComputing && (
        <div className="compute-status computing">
          <div className="spinner" />
          <span>Computing overlays...</span>
        </div>
      )}
      {status.lastError && (
        <div className="compute-status error">
          <span>⚠️ {status.lastError}</span>
        </div>
      )}
    </div>
  );
};
