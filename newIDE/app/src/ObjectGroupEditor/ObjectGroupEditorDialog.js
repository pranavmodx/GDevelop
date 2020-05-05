import { Trans } from '@lingui/macro';
import React, { Component } from 'react';
import FlatButton from '../UI/FlatButton';
import ObjectGroupEditor from '.';
import Dialog from '../UI/Dialog';
import { withSerializableObject } from '../Utils/SerializableObjectEditorContainer';
const gd = global.gd;

export class ObjectGroupEditorDialog extends Component {
  render() {
    const { project, group } = this.props;
    if (!group) return null;

    const actions = [
      <FlatButton
        key="cancel"
        label={<Trans>Cancel</Trans>}
        keyboardFocused
        onClick={this.props.onCancel}
      />,
      <FlatButton
        key="apply"
        label={<Trans>Apply</Trans>}
        primary
        keyboardFocused
        onClick={this.props.onApply}
      />,
    ];

    return (
      <Dialog
        key={group.ptr}
        actions={actions}
        noMargin
        cannotBeDismissed={true}
        onRequestClose={this.props.onCancel}
        open={this.props.open}
        title={`Edit ${group.getName()} group`}
      >
        <ObjectGroupEditor
          project={project}
          group={group}
          globalObjectsContainer={this.props.globalObjectsContainer}
          objectsContainer={this.props.objectsContainer}
          onSizeUpdated={
            () =>
              this.forceUpdate() /*Force update to ensure dialog is properly positionned*/
          }
        />
      </Dialog>
    );
  }
}

export default withSerializableObject(ObjectGroupEditorDialog, {
  newObjectCreator: () => new gd.ObjectGroup(),
  propName: 'group',
});
