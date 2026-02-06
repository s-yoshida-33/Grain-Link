import React from 'react';

interface ImageHeaderProps {
  imageUrl?: string;
}

export const ImageHeader: React.FC<ImageHeaderProps> = ({ imageUrl }) => {
  return (
    <div className="w-full h-full bg-gray-200 overflow-hidden relative">
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt="Shop Header" 
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
          <span className="text-2xl">No Image</span>
        </div>
      )}
    </div>
  );
};
