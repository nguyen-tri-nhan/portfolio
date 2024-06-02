import React from 'react';
import { Box, keyframes } from '@mui/system';
import { styled } from '@mui/material/styles';
import colors from '../../../utils/token';

const moveBinary = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
`;

const BinaryBackgroundContainer = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1;
  background: ${colors.whiteBackground}; /* Background color from palette */
`;

const BinaryText = styled(Box)<{ duration: number; delay: number; left: number }>`
  position: absolute;
  top: 0;
  left: ${({ left }) => left}%;
  color: ${colors.primaryBlue}; /* Binary text color from palette */
  font-family: 'Courier New', Courier, monospace;
  white-space: nowrap;
  font-size: 3rem; /* Make binary text larger */
  opacity: 0.25; /* Make binary text more subtle */
  filter: blur(2px); /* Apply blur effect */
  animation: ${moveBinary} ${({ duration }) => duration}s linear infinite;
  animation-delay: ${({ delay }) => delay}s;
  user-select: none;
`;

const generateBinaryCode = () => {
  let binaryCode = '';
  for (let i = 0; i < 100; i++) {
    binaryCode += Math.round(Math.random()).toString();
  }
  return binaryCode;
};

const generateRandomBinaryText = (numLines: number) => {
  const binaryLines = [];
  for (let i = 0; i < numLines; i++) {
    const duration = Math.random() * 10 + 5; // Random duration between 5s and 15s
    const delay = Math.random() * 5; // Random delay between 0s and 5s
    const left = Math.random() * 100; // Random left position between 0% and 100%
    binaryLines.push({ code: generateBinaryCode(), duration, delay, left });
  }
  return binaryLines;
};

const BinaryBackground: React.FC = () => {
  const binaryLines = generateRandomBinaryText(30);

  return (
    <BinaryBackgroundContainer>
      {binaryLines.map((line, index) => (
        <BinaryText
          key={index}
          duration={line.duration}
          delay={line.delay}
          left={line.left}
        >
          {line.code}
        </BinaryText>
      ))}
    </BinaryBackgroundContainer>
  );
};

export default BinaryBackground;
