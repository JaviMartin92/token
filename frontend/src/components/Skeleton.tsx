import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className={`animate-pulse bg-gray-700 rounded ${className}`}
          style={{ minHeight: '1rem', width: '100%' }}
        />
      ))}
    </>
  );
};
