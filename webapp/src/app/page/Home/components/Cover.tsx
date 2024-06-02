import React, { useState } from "react";
import { Box, CssBaseline } from "@mui/material";
import Typewriter from "./Typewriter";


const Cover: React.FC = () => {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);

  return (
    <>
      <CssBaseline />
      <Box mb={2}>
        <Typewriter
          text="Nhan Nguyen"
          variant="h2"
          delay={0}
          onTypingComplete={() => setLine1Complete(true)}
          showCursor={!line1Complete}
        />
      </Box>
      {line1Complete && (
        <Box mb={2}>
          <Typewriter
            text="Welcome to my portfolio"
            variant="h3"
            delay={0}
            onTypingComplete={() => setLine2Complete(true)}
            showCursor={!line2Complete}
          />
        </Box>
      )}
      {line2Complete && (
        <Box mb={2}>
          <Typewriter
            text="Let's build something amazing!"
            variant="h4"
            delay={0}
            isLastLine={true}
          />
        </Box>
      )}
    </>
  );
};

export default Cover;
