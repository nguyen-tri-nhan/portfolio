import React from 'react';
import { Button, Typography, styled } from '@mui/material';
import { Facebook, GetApp, GitHub, LinkedIn } from '@mui/icons-material';
import { ProfileEnv } from '../model/env';
import colors from '../utils/token';
import CV from '../../assets/CV/CV_NhanNguyen_FullStack.pdf';
import { useTranslation } from 'react-i18next';

const FooterContainer = styled('footer')`
    background-color: ${({ theme }) => theme.palette.primary.main};
    color: ${({ theme }) => theme.palette.primary.contrastText};
    padding: ${({ theme }) => theme.spacing(2)};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const StyledButton = styled(Button)`
    margin: ${({ theme }) => theme.spacing(1)};
    text-transform: unset;
`;

const ProfileButtons = [
  {
    label: 'nguyen-tri-nhan',
    url: ProfileEnv.GitHub,
    icon: <GitHub />,
  },
  {
    label: 'Nguyễn Trí Nhân',
    url: ProfileEnv.Facebook,
    icon: <Facebook />,
  },
  {
    label: 'Nguyễn Trí Nhân',
    url: ProfileEnv.LinkedIn,
    icon: <LinkedIn />,
  },
];
const Footer: React.FC = () => {

  const { t } = useTranslation();

  return (
    <FooterContainer>
      <div>
        <Typography
          variant="h4"
          color={colors.whiteBackground}
        >
          {t('footer.getInTouch')}
        </Typography>
      </div>
      <div>
        {ProfileButtons.map((button) => (
          <StyledButton
            key={button.url}
            color="inherit"
            startIcon={button.icon}
            href={button.url}
            disableRipple
          >
            {button.label}
          </StyledButton>
        ))}
        <StyledButton
          color="inherit"
          startIcon={<GetApp />}
          href={CV}
        >
          {t('footer.downloadResume')}
        </StyledButton>
      </div>
    </FooterContainer>
  );
};

export default Footer;
