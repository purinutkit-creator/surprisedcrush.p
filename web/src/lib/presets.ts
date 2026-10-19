/** Same presets as the server (server/src/defaults.ts). */
export const THEME_PRESETS: Record<string, Record<string, string>> = {
  pink: {
    primary: '#FF82AB', secondary: '#FFD6E7', accent: '#E9D5FF', background: '#FFF9F5', text: '#5B3A4A',
    button: '#FF82AB', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFD6E7',
    gradientFrom: '#FFD6E7', gradientVia: '#FFF9F5', gradientTo: '#E9D5FF',
  },
  lavender: {
    primary: '#A78BFA', secondary: '#E9D5FF', accent: '#FFD6E7', background: '#FAF5FF', text: '#4C3A63',
    button: '#A78BFA', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#E9D5FF',
    gradientFrom: '#E9D5FF', gradientVia: '#FAF5FF', gradientTo: '#C7D2FE',
  },
  cream: {
    primary: '#F4A261', secondary: '#FFE8CC', accent: '#FFD6E7', background: '#FFFBF2', text: '#5C4632',
    button: '#F4A261', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFE8CC',
    gradientFrom: '#FFF3D6', gradientVia: '#FFFBF2', gradientTo: '#FFD8C2',
  },
  blue: {
    primary: '#60A5FA', secondary: '#DBEAFE', accent: '#FFD6E7', background: '#F5FAFF', text: '#2F4561',
    button: '#60A5FA', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#DBEAFE',
    gradientFrom: '#DBEAFE', gradientVia: '#F5FAFF', gradientTo: '#FCE7F3',
  },
  peach: {
    primary: '#FF8A65', secondary: '#FFD8C2', accent: '#FFD6E7', background: '#FFF7F2', text: '#5E3B33',
    button: '#FF8A65', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFD8C2',
    gradientFrom: '#FFD8C2', gradientVia: '#FFF7F2', gradientTo: '#FFD6E7',
  },
  white: {
    primary: '#E26D96', secondary: '#F4F4F5', accent: '#FCE7F3', background: '#FFFFFF', text: '#3F3F46',
    button: '#3F3F46', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#E4E4E7',
    gradientFrom: '#FFFFFF', gradientVia: '#FAFAFA', gradientTo: '#FDF2F8',
  },
};

export const PRESET_NAMES: Record<string, string> = {
  pink: 'Pink Sweetheart', lavender: 'Lavender Dream', cream: 'Creamy Birthday', blue: 'Baby Blue Love', peach: 'Peach Romance', white: 'Minimal White', custom: 'Custom Theme',
};
