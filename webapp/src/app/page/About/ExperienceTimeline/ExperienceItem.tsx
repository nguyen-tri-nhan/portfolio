import { LaptopMac } from "@mui/icons-material";
import {
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator
} from "@mui/lab";
import { Typography } from "@mui/material";
import React from "react";

type ExperienceItemProps = {
  first?: boolean;
  time: string;
  title: string;
  company: string;
  icon: React.ReactNode;
  last?: boolean;
}
export const ExperienceItem: React.FC<ExperienceItemProps> = React.memo(({ time, title, company, icon = <LaptopMac />, last = false, first }) => {
  return (
    <TimelineItem>
      <TimelineOppositeContent color="textSecondary">
        <Typography variant="h6">{time}</Typography>
      </TimelineOppositeContent>
      <TimelineSeparator>
        <TimelineDot color={first ? "primary" : undefined}>
          {icon}
        </TimelineDot>
        {!last && <TimelineConnector />}
      </TimelineSeparator>
      <TimelineContent>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body1">{company}</Typography>
      </TimelineContent>
    </TimelineItem>
  );
});