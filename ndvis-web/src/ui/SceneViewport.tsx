import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";

export const SceneViewport = () => {
  return (
    <section className="scene-viewport">
      <Canvas camera={{ position: [4, 4, 4], fov: 60 }}>
        <color attach="background" args={["#0f172a"]} />
        <Suspense fallback={null}>
          <DummyScene />
        </Suspense>
        <axesHelper args={[2]} />
        <OrbitControls makeDefault />
      </Canvas>
    </section>
  );
};

const DummyScene = () => {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#38bdf8" wireframe />
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.75} position={[5, 5, 5]} />
    </mesh>
  );
};
