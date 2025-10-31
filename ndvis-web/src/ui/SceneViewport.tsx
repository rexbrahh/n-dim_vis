import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { OrbitControls } from "@react-three/drei";
import { BufferGeometry, BufferAttribute } from "three";

import { useAppState } from "@/state/appState";
import { createRenderer, type GeometryConfig, type RenderBuffers, type RendererHandle } from "@/gpu/renderer";
import { createBindings } from "@/wasm/ndvis";

const enableExperimentalRenderer = typeof import.meta !== "undefined" && import.meta.env?.VITE_NDVIS_ENABLE_EXPERIMENTAL_RENDERER === "1";

export const SceneViewport = () => {
  const overlays = useAppState((state) => state.overlays);
  const computeStatus = useAppState((state) => state.computeStatus);
  const hyperplane = useAppState((state) => state.hyperplane);
  const calculus = useAppState((state) => state.calculus);

  return (
    <section className="scene-viewport">
      <Canvas camera={{ position: [4, 4, 4], fov: 60 }}>
        <color attach="background" args={["#111111"]} />
        <Suspense fallback={null}>
          <HyperScene
            overlays={overlays}
            hyperplaneEnabled={hyperplane.enabled && hyperplane.showIntersection}
            calculusConfig={calculus}
          />
        </Suspense>
        <axesHelper args={[2]} />
        <OrbitControls 
          makeDefault 
          enableDamping 
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={20}
          enablePan
          panSpeed={0.5}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
      </Canvas>
      <ComputeStatusOverlay status={computeStatus} />
      <CameraHelpOverlay />
    </section>
  );
};

const CameraHelpOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="camera-help-overlay">
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="help-toggle"
        title="Camera controls help"
      >
        ?
      </button>
      {isVisible && (
        <div className="help-panel">
          <h4>Camera Controls</h4>
          <dl>
            <dt>Orbit</dt>
            <dd>Left mouse drag</dd>
            <dt>Pan</dt>
            <dd>Right mouse drag</dd>
            <dt>Zoom</dt>
            <dd>Scroll wheel</dd>
          </dl>
        </div>
      )}
    </div>
  );
};

type HyperSceneProps = {
  overlays: {
    sliceGeometry: Float32Array | null;
    levelSetCurves: Float32Array[] | null;
    levelSetPointClouds: Float32Array[] | null;
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

  // Initialise optional GPU/WebGL compute renderer once (behind flag)
  useEffect(() => {
    if (!enableExperimentalRenderer) {
      return undefined;
    }

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
    if (!enableExperimentalRenderer || !renderer) {
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

  const edgeGeometry = useMemo(() => {
    if (!positions3d) return null;

    const linePositions: number[] = [];
    for (let e = 0; e < geometry.edgeCount; e++) {
      const u = geometry.edges[e * 2];
      const v = geometry.edges[e * 2 + 1];
      
      linePositions.push(
        positions3d[u * 3], positions3d[u * 3 + 1], positions3d[u * 3 + 2],
        positions3d[v * 3], positions3d[v * 3 + 1], positions3d[v * 3 + 2]
      );
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(linePositions), 3));
    return geo;
  }, [positions3d, geometry.edges, geometry.edgeCount]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.75} position={[5, 5, 5]} />

      {positions3d && (
        <>
          <points>
            <bufferGeometry ref={geometryRef} />
            <pointsMaterial color="#f4f4f5" size={0.15} sizeAttenuation={false} />
          </points>
          
          {edgeGeometry && (
            <lineSegments geometry={edgeGeometry}>
              <lineBasicMaterial color="#71717a" opacity={0.6} transparent />
            </lineSegments>
          )}
        </>
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
          <lineBasicMaterial color="#d4d4d8" />
        </line>
      )}

      {calculusConfig.showLevelSets && overlays.levelSetCurves && (
        <group name="level-sets">
          {overlays.levelSetCurves.map((curve, index) => (
            <line key={index}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[curve, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#e5e5e5" />
            </line>
          ))}
        </group>
      )}

      {calculusConfig.showLevelSets && overlays.levelSetPointClouds && (
        <group name="level-set-clouds">
          {overlays.levelSetPointClouds.map((cloud, index) => (
            <points key={`level-set-cloud-${index}`}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[cloud, 3]} />
              </bufferGeometry>
              <pointsMaterial color="#e5e5e5" size={0.06} sizeAttenuation />
            </points>
          ))}
        </group>
      )}

      {calculusConfig.showGradient && overlays.gradientVectors && (
        <line name="gradient-vectors">
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlays.gradientVectors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#d4d4d8" />
        </line>
      )}

      {calculusConfig.showTangentPlane && overlays.tangentPatch && (
        <mesh name="tangent-plane">
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlays.tangentPatch, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color="#d4d4d8" opacity={0.4} transparent side={2} />
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
