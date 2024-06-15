import React, { useEffect, useRef } from 'react';
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
import { fireLanguageChangeEvent } from '../event/languageChange';

const LanguageSelectorWrapper = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
}));



type TextColor = 'black' | 'white';
type LanguageSelectorProps = {
  textColor?: TextColor;
};

const LanguageSelector = React.memo(({ textColor }: LanguageSelectorProps) => {

  const StyledSelect = styled(Select)(() => ({
    color: textColor === 'white' ? colors.whiteBackground : colors.blackText,
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
      color: textColor === 'white' ? colors.whiteBackground : colors.blackText,
    },
  }));


  const language: React.MutableRefObject<string> = useRef(getLanguage());
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(language.current);
  }, [i18n])

  const handleChange = (event: SelectChangeEvent<unknown>) => {
    const newLanguage = event.target.value as string;
    language.current = newLanguage;
    i18n.changeLanguage(newLanguage).then(() => {
      fireLanguageChangeEvent(newLanguage);
    });
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