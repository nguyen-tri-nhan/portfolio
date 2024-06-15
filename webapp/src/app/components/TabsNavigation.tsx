import React from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { navItems } from '../model/navigation';
import { Link, useLocation } from 'react-router-dom';
import colors from '../utils/token';
import { styled } from '@mui/material';
import { useTranslation } from 'react-i18next';

function LinkTab(props: { label: string; href: string; selected?: boolean }) {
  return (
    <Tab
      component={Link}
      to={props.href}
      aria-current={props.selected && 'page'}
      {...props}
    />
  );
}

export const TabsNavigation = React.memo(() => {
  const location = useLocation();
  const { t } = useTranslation();




  const findBestMatchIndex = React.useMemo(() => {
    return (): number => {
      const currentPath = location.pathname;
      let bestMatchIndex = -1;
      let longestMatchLength = 0;
    
      navItems.forEach((navItem, index) => {
        if (currentPath.startsWith(navItem.path) && navItem.path.length > longestMatchLength) {
          bestMatchIndex = index;
          longestMatchLength = navItem.path.length;
        }
      });
    
      return bestMatchIndex;
    };
  }, [location.pathname]);

  const currentIndex = findBestMatchIndex();



  React.useEffect(() => {
    const newIndex = findBestMatchIndex();
    setValue(newIndex !== -1 ? newIndex : 0);
  }, [findBestMatchIndex]);

  const [value, setValue] = React.useState(currentIndex !== -1 ? currentIndex : 0);

  const handleChange = (_event: React.SyntheticEvent<Element, Event>, newValue: React.SetStateAction<number>) => {
    setValue(newValue);
  };

  const StyledTabs = styled(Tabs)(() => ({
    '& .MuiTabs-indicator': {
      backgroundColor: colors.whiteBackground,
    },
  }));

  const StyledTab = styled(LinkTab)(() => ({
    color: colors.whiteBackground,
    '&:hover': {
      fontWeight: 'bold',
      color: colors.lightGray,
    },
    '&.Mui-selected': {
      fontWeight: 'bold',
      color: colors.whiteBackground,
    },
  }));

  return (
    <Box sx={{ width: '100%' }}>
      <StyledTabs
        value={value}
        onChange={handleChange}
        aria-label="Tab navigation"
        role="navigation"
      >
        {navItems.map((navItem, index) => (
          <StyledTab
            key={index}
            label={t(navItem.name)}
            href={navItem.path}
            selected={value === index}
          />
        ))}
      </StyledTabs>
    </Box>
  );
});
