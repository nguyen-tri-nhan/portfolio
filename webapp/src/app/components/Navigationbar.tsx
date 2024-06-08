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
import { styled } from '@mui/material';

const drawerWidth = 240;

type NavItem = {
  name: string;
  path: string;
};

const navItems: NavItem[] = [
  { name: 'Home', path: '/' },
  { name: 'Projects', path: '/projects' },
  { name: 'Blogs', path: '/blogs' },
  { name: 'About', path: '/about' },
];

function Navigationbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState<boolean>(false);

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
        Nhan Nguyen
      </Typography>
      <Divider />
      <List>
        {navItems.map(({ name, path }: NavItem) => (
          <ListItem key={name} disablePadding>
            <ListItemButton onClick={() => navigate(path)} sx={{ textAlign: 'center' }}>
              <ListItemText primary={name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const container = window !== undefined ? () => window.document.body : undefined;

  const StyledNavItems = styled(Typography)(() => ({
    '&:hover': {
      color: colors.lightBlueText,
    },
    '&:not(:last-child)': {
      marginRight: '16px',
    },
  }));

  const renderNavItems = () => navItems.map(({ name, path }: NavItem) => (
    <StyledNavItems
      variant="h6"
    >
      <Link to={path} style={{ textDecoration: 'none', color: 'white' }}>
        {name}
      </Link>
    </StyledNavItems>
  ))

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
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}
          >
            <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
              Nhan Nguyen
            </Link>
          </Typography>
          <Box sx={{ display: { xs: 'none', sm: 'block', md: 'flex' } }}>
            {renderNavItems()}
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
            display: { xs: 'block', sm: 'none' },
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
