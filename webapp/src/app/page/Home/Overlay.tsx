import React, { useEffect } from 'react';
import { Box, keyframes } from '@mui/system';
import { styled } from '@mui/material/styles';
import colors from '../../utils/token';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const moveColorToPosition = (x: string, y: string) => keyframes`
  from { transform: translate(-50%, -50%) translate(0, 0); }
  to { transform: translate(-50%, -50%) translate(${x}, ${y}); }
`;

const OverlayContainer = styled(Box)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8); /* Adjust opacity and color as needed */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 1s forwards;
`;

const ColorSquare = styled(Box) <{ color: string; delay: number; startX: string; startY: string; endX: string; endY: string }>`
  width: 50px;
  height: 50px;
  background: ${({ color }) => color};
  position: absolute;
  animation: ${({ endX, endY }) => moveColorToPosition(endX, endY)} 1s forwards, ${fadeIn} 1s forwards;
`;

const colorsBinding = [
  colors.primaryBlue,
  colors.secondaryBlue,
  colors.accentBlue,
  colors.whiteBackground,
  colors.buttonHoverBlue,
  colors.blackText,
]

const colorsData = colorsBinding.map((color, index) => ({
  color,
  startX: `${-300 + index * 50}px`,
  startY: '0',
  endX: `${-100 + index * 50}px`,
  endY: '0',
  delay: index / 5,
}));

const Overlay: React.FC<{ show: boolean }> = ({ show }) => {
  useEffect(() => {
    if (!show) {
      document.body.style.overflow = 'auto'; // Restore body overflow
    } else {
      document.body.style.overflow = 'hidden'; // Prevent scrolling when overlay is shown
    }
    return () => {
      document.body.style.overflow = 'auto'; // Restore body overflow on unmount
    };
  }, [show]);

  if (!show) return null;

  return (
    <OverlayContainer>
      {colorsData.map((colorData, index) => (
        <ColorSquare
          key={index}
          color={colorData.color}
          startX={colorData.startX}
          startY={colorData.startY}
          endX={colorData.endX}
          endY={colorData.endY}
          delay={colorData.delay}
        />
      ))}
    </OverlayContainer>
  );
};

export default Overlay;
