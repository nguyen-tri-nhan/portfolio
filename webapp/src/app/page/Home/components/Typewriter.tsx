import React, { useEffect, useState } from "react";
import { Box, Typography, TypographyProps } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledBox = styled(Box)`
  &.typewriter-effect {
    display: flex;
    flex-direction: column;
    font-family: monospace;
  }

  & .cursor {
    display: inline-block;
    margin-left: 2px;
  }

  & .text {
    max-width: 0;
    animation: typing 1.5s steps(var(--characters)) forwards;
    white-space: nowrap;
    overflow: hidden;
    position: relative;
  }

  & .cursor::after {
    content: "|";
    animation: blink 1s infinite;
    animation-timing-function: step-end;
  }

  & .cursor.typing::after {
    animation: none;
  }

  & .cursor.blink::after {
    animation: blink 1s infinite;
    animation-timing-function: step-end;
  }

  @keyframes typing {
    100% {
      max-width: calc(var(--characters) * 1ch);
    }
  }

  @keyframes blink {
    0%, 75%, 100% {
      opacity: 1;
    }
    25% {
      opacity: 0;
    }
  }
`;

interface CustomStyles extends React.CSSProperties {
  "--characters": number | string;
}

interface TypewriterProps extends TypographyProps {
  text: string;
  delay?: number; // delay before starting this line
  onTypingComplete?: () => void;
  showCursor?: boolean;
  isLastLine?: boolean;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, delay = 0, onTypingComplete, showCursor = true, isLastLine = false, ...typographyProps }) => {
  const [show, setShow] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);

  const styles: CustomStyles = {
    "--characters": text.length,
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
      const typingTimer = setTimeout(() => {
        setTypingComplete(true);
        if (onTypingComplete) {
          onTypingComplete();
        }
      }, 1500); // 3 seconds typing animation duration
      return () => clearTimeout(typingTimer);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, onTypingComplete]);

  if (!show) return null;

  return (
    <StyledBox className="typewriter-effect">
      <Typography
        style={styles}
        className={`text ${showCursor ? 'cursor' : ''} ${isLastLine && typingComplete ? 'blink' : ''}`}
        {...typographyProps}
      >
        {text}
      </Typography>
    </StyledBox>
  );
};

export default Typewriter;
