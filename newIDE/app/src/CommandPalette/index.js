import React, { Component } from 'react';
import CommandPalette from 'react-command-palette';
import chrome from '../../node_modules/react-command-palette/themes/chrome-theme';
import '../../node_modules/react-command-palette/themes/chrome.css';

export default class CommandPaletteDialog extends Component {
  constructor(props) {
    super(props);

    this.state = {
      commands : [
        {
          name: 'About',
        },
        {
          name: 'Profile',
        },
      ],
    }
    // additional commands can be added in as keys for 'commands' state
  }

  setDialogState = (command) => {
    this.props.onSetDialogState(command.name);
  }

  render() {
    return (
      <CommandPalette
        commands={commands}
        theme={chrome}
        open={true}
        placeholder="Search for any GDevelop feature and perform an action"
        onSelect={command => {
          this.props.onClose(); // For closing palette box
          this.setDialogState(command);
        }}
        closeOnSelect={true}
      />
    );
  }
}
