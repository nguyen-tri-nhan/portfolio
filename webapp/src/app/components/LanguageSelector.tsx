import React, { useCallback, useEffect, useRef } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  styled,
  selectClasses,
  outlinedInputClasses,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material';
import colors from '../utils/token';
import { useTranslation } from 'react-i18next';
import { getLanguage, setLanguage } from '../utils/localStorage';
import { useAppDispatch, useAppSelector } from '../redux/hook';
import { fetchBlogs } from '../redux/slices/blogSlice';
import { selectBlogs } from '../redux/selectors/blogSelector';

const LanguageSelectorWrapper = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const StyledSelect = styled(Select)(() => ({
  color: colors.whiteBackground,
  padding: 0,
  [`.${selectClasses.select}`]: {
    padding: '0 12px',
  },
  [`.${outlinedInputClasses.notchedOutline}`]: {
    border: 0,
  },
  [`.${outlinedInputClasses.root}`]: {
    [`&:hover .${outlinedInputClasses.notchedOutline}`]: {
      border: 0,
    },
    [`&.Mui-focused .${outlinedInputClasses.notchedOutline}`]: {
      border: 0,
    },
  },
  [`.${selectClasses.icon}`]: {
    color: colors.whiteBackground,
  },
}));

const LanguageSelector = React.memo(() => {
  const language: React.MutableRefObject<string> = useRef(getLanguage());
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const blogs = useAppSelector(selectBlogs);

  const onLanguageChange = useCallback(() => {
    if (blogs.length === 0) return;
    dispatch(fetchBlogs());
  }, [blogs.length, dispatch]);

  useEffect(() => {
    i18n.changeLanguage(language.current);
  }, [i18n])

  const handleChange = (event: SelectChangeEvent<unknown>) => {
    const newLanguage = event.target.value as string;
    language.current = newLanguage;
    i18n.changeLanguage(newLanguage).then(onLanguageChange);
    setLanguage(newLanguage);
  };

  return (
    <LanguageSelectorWrapper>
      <FormControl>
        <StyledSelect
          labelId="language-label"
          id="language-select"
          value={language.current}
          onChange={handleChange}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="vi">Tiếng Việt</MenuItem>
        </StyledSelect>
      </FormControl>
    </LanguageSelectorWrapper>
  );
});

export default LanguageSelector;