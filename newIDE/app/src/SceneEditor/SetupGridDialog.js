import { Trans } from '@lingui/macro';
import React, { Component } from 'react';
import FlatButton from '../UI/FlatButton';
import TextField from '../UI/TextField';
import Dialog from '../UI/Dialog';

export default class SetupGridDialog extends Component {
  constructor(props) {
    super(props);
    this.state = { ...props.gridOptions };
  }

  _onApply = () => {
    this.props.onApply({
      gridWidth: this.state.gridWidth,
      gridHeight: this.state.gridHeight,
      gridOffsetX: this.state.gridOffsetX,
      gridOffsetY: this.state.gridOffsetY,
    });
  };

  render() {
    const actions = [
      <FlatButton
        key="cancel"
        label={<Trans>Cancel</Trans>}
        primary={false}
        onClick={this.props.onCancel}
      />,
      <FlatButton
        key="apply"
        label={<Trans>Apply</Trans>}
        primary={true}
        keyboardFocused={true}
        onClick={this._onApply}
      />,
    ];

    return (
      <Dialog
        actions={actions}
        cannotBeDismissed={true}
        open={this.props.open}
        onRequestClose={this.props.onCancel}
      >
        <TextField
          floatingLabelText={<Trans>Cell width (in pixels)</Trans>}
          type="number"
          value={this.state.gridWidth}
          onChange={(e, value) =>
            this.setState({ gridWidth: parseInt(value, 10) })
          }
        />
        <TextField
          floatingLabelText={<Trans>Cell height (in pixels)</Trans>}
          type="number"
          value={this.state.gridHeight}
          onChange={(e, value) =>
            this.setState({ gridHeight: parseInt(value, 10) })
          }
        />
        <TextField
          floatingLabelText={<Trans>X offset (in pixels)</Trans>}
          type="number"
          value={this.state.gridOffsetX}
          onChange={(e, value) =>
            this.setState({ gridOffsetX: parseInt(value, 10) })
          }
        />
        <TextField
          floatingLabelText={<Trans>Y offset (in pixels)</Trans>}
          type="number"
          value={this.state.gridOffsetY}
          onChange={(e, value) =>
            this.setState({ gridOffsetY: parseInt(value, 10) })
          }
        />
      </Dialog>
    );
  }
}
