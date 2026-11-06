import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float, Stars, Torus, Icosahedron, Octahedron } from "@react-three/drei";
import * as THREE from "three";

const FloatingIcosahedron: React.FC<{ position: [number, number, number]; speed?: number }> = ({
  position,
  speed = 0.4,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * speed * 0.5;
      meshRef.current.rotation.y += delta * speed;
    }
  });
  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={1.2}>
      <Icosahedron ref={meshRef} args={[1, 1]} position={position}>
        <MeshDistortMaterial
          color="#E84142"
          emissive="#8b0000"
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.1}
          distort={0.3}
          speed={2}
          transparent
          opacity={0.85}
        />
      </Icosahedron>
    </Float>
  );
};

const FloatingTorus: React.FC<{ position: [number, number, number]; speed?: number }> = ({
  position,
  speed = 0.3,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * speed;
      meshRef.current.rotation.z += delta * speed * 0.7;
    }
  });
  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
      <Torus ref={meshRef} args={[1, 0.3, 16, 60]} position={position}>
        <meshStandardMaterial
          color="#E84142"
          emissive="#E84142"
          emissiveIntensity={0.3}
          metalness={0.9}
          roughness={0.05}
          wireframe
        />
      </Torus>
    </Float>
  );
};

const FloatingOctahedron: React.FC<{ position: [number, number, number]; speed?: number }> = ({
  position,
  speed = 0.5,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * speed;
      meshRef.current.rotation.x += delta * speed * 0.3;
    }
  });
  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={1.5}>
      <Octahedron ref={meshRef} args={[1]} position={position}>
        <MeshDistortMaterial
          color="#ff6b35"
          emissive="#E84142"
          emissiveIntensity={0.4}
          metalness={0.7}
          roughness={0.2}
          distort={0.4}
          speed={1.5}
          transparent
          opacity={0.75}
        />
      </Octahedron>
    </Float>
  );
};

export const Scene3D: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 60 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#E84142" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#4040ff" />
      <spotLight position={[0, 20, 0]} intensity={1} color="#ffffff" angle={0.3} />

      <Stars radius={80} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1} />

      <FloatingIcosahedron position={[-4, 1.5, -2]} speed={0.4} />
      <FloatingIcosahedron position={[5, -1, -4]} speed={0.25} />
      <FloatingTorus position={[3, 2, -1]} speed={0.35} />
      <FloatingTorus position={[-5, -2, -3]} speed={0.2} />
      <FloatingOctahedron position={[0, -2.5, -1]} speed={0.45} />
      <FloatingOctahedron position={[-2, 3, -5]} speed={0.3} />
    </Canvas>
  );
};
