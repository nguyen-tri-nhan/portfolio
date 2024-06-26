import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Link, useNavigate } from 'react-router-dom';
import colors from '../utils/token';
import { TabsNavigation } from './TabsNavigation';
import { NavItem, navItems } from '../model/navigation';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

const drawerWidth = 240;

function Navigationbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState<boolean>(false);

  const { t } = useTranslation();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkScroll = () => {
        setIsScrolled(window.scrollY > 0);
      };

      window.addEventListener('scroll', checkScroll);

      return () => {
        window.removeEventListener('scroll', checkScroll);
      };
    }
  }, []);

  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2 }}>
        {t('brand')}
      </Typography>
      <Divider />
      <List>
        {navItems.map(({ name, path }: NavItem) => (
          <ListItem key={name} disablePadding>
            <ListItemButton onClick={() => navigate(path)} sx={{ textAlign: 'center' }}>
              <ListItemText primary={t(name)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <LanguageSelector textColor="black" />
    </Box>
  );

  const container = window !== undefined ? () => window.document.body : undefined;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar component="nav" style={{
        backdropFilter: 'blur(10px)',
        backgroundColor: isScrolled ? colors.primaryBlueWithOpacity : colors.primaryBlue,
      }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}
          >
            <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
              {t('brand')}
            </Link>
          </Typography>
          <Box sx={{ display: { xs: 'none', sm: 'none', md: 'flex' } }}>
            <TabsNavigation />
            <LanguageSelector textColor="white" />
          </Box>
        </Toolbar>
      </AppBar>
      <nav>
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            height: '48px'
          }}
        >
          {drawer}
        </Drawer>
      </nav>
    </Box>
  );
}

export default Navigationbar;
