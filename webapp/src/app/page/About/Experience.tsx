import React from "react";
import Timeline from '@mui/lab/Timeline';
import { ExperienceItem } from "./ExperienceTimeline/ExperienceItem";
import { School } from "@mui/icons-material";

type ExperienceItemProps = {
  time: string;
  title: string;
  company: string;
  icon?: React.ReactNode;
};

const Experiences: ExperienceItemProps[] = [
  {
    time: 'Mar 2021 - Now',
    title: 'Software Engineer',
    company: 'Katalon',
  },
  {
    time: 'Dec 2020 - Mar 2021',
    title: 'Software Engineer Intern',
    company: 'KMS Technology',
    icon: <School />
  },
  {
    time: '2018 - 2022',
    title: 'Bachelor of Software Engineering',
    company: 'FPT University',
    icon: <School />
  },
]

export const Experience: React.FC = React.memo(() => {
  return (
    <Timeline>
      {Experiences.map((experience, index) => (
        <ExperienceItem
          key={index}
          time={experience.time}
          title={experience.title}
          company={experience.company}
          icon={experience.icon}
          last={index === Experiences.length - 1}
          first={index === 0}
        />
      ))}
    </Timeline>
  );
});
