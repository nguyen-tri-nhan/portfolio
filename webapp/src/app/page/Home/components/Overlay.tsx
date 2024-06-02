import React, { useEffect } from 'react';
import { Box, keyframes } from '@mui/system';
import { styled } from '@mui/material/styles';
import colors from '../../../utils/token';

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const moveColorToPosition = (startX: string, startY: string, endX: string, endY: string) => keyframes`
  from { transform: translate(-50%, -50%) translate(${startX}, ${startY}); }
  to { transform: translate(-50%, -50%) translate(${endX}, ${endY}); }
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
`;

const ColorSquare = styled(Box) <{ color: string; delay: number; startX: string; startY: string; endX: string; endY: string }>`
  width: 100px;
  height: 100px;
  background: ${({ color }) => color};
  position: absolute;
  animation: ${({ startX, startY, endX, endY }) => moveColorToPosition(startX, startY, endX, endY)} ${({ delay }) => delay}s forwards, ${fadeOut} ${({ delay }) => 3 * delay}s forwards;
`;

const colorsBinding = [
  colors.primaryBlue,
  colors.secondaryBlue,
  colors.headingBlue,
  colors.whiteBackground,
  colors.primaryBlueWithOpacity,
  colors.blackText,
]

const initialColorData = colorsBinding.map((color, index) => ({
  color,
  startX: `${-200 + index * 100}px`,
  startY: '0',
  endX: `${-100 + index * 50}px`,
  endY: '0',
  delay: (index + 1) * 0.5,
}));

const colorData = [
  ...[{ ...initialColorData[0], endX: '-800px', endY: '-400px' }], //colors.primaryBlue
  ...[{ ...initialColorData[1], endX: '100px', endY: '100px' }], //colors.secondaryBlue
  ...[{ ...initialColorData[2], endX: '200px', endY: '200px' }], //colors.headingBlue
  ...[{ ...initialColorData[3], endX: '200px', endY: '800px' }], //colors.whiteBackground
  ...[{ ...initialColorData[4], endX: '400px', endY: '400px' }], //colors.primaryBlueWithOpacity
  ...[{ ...initialColorData[5], endX: '-400px', endY: '-200px' }], //colors.blackText
];

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
      {colorData.map((colorData, index) => (
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
