import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { useAppState } from "@/state/appState";

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
          <DummyScene />
          <OverlayRenderer
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

const DummyScene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.75} position={[5, 5, 5]} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#38bdf8" wireframe />
      </mesh>
    </>
  );
};

type OverlayRendererProps = {
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

const OverlayRenderer = ({ overlays, hyperplaneEnabled, calculusConfig }: OverlayRendererProps) => {
  return (
    <group name="overlays">
      {/* Hyperplane intersection slice */}
      {hyperplaneEnabled && overlays.sliceGeometry && (
        <line name="hyperplane-slice">
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[overlays.sliceGeometry, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ff8800" />
        </line>
      )}

      {/* Level set curves */}
      {calculusConfig.showLevelSets && overlays.levelSetCurves && (
        <group name="level-sets">
          {overlays.levelSetCurves.map((curve, index) => (
            <line key={index}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[curve, 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#10b981" />
            </line>
          ))}
        </group>
      )}

      {/* Gradient vectors */}
      {calculusConfig.showGradient && overlays.gradientVectors && (
        <line name="gradient-vectors">
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[overlays.gradientVectors, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#f59e0b" />
        </line>
      )}

      {/* Tangent plane patch */}
      {calculusConfig.showTangentPlane && overlays.tangentPatch && (
        <mesh name="tangent-plane">
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[overlays.tangentPatch, 3]}
            />
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
