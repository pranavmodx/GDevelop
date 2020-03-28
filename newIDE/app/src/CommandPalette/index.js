import React, { Component } from 'react';
import CommandPalette from 'react-command-palette';
import chrome from '../../node_modules/react-command-palette/themes/chrome-theme';
import '../../node_modules/react-command-palette/themes/chrome.css';

const commands = [
  {
    name: 'About',
    command() {}
  },
  {
    name: 'Profile',
    command() {},
  },
];

export default class CommandPaletteDialog extends Component {
  render() {
    return (
      <CommandPalette
        commands={commands}
        theme={chrome}
        open={true}
        placeholder="Search for any GDevelop features and perform an action" 
      />
    );
  }
}
