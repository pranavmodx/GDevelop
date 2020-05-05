// @flow
import * as React from 'react';
import { t } from '@lingui/macro';
import Dialog from './Dialog';
import TextField from './TextField';
import FlatButton from './FlatButton';
import { Trans } from '@lingui/macro';
import { type Tags, getTagsFromString } from '../Utils/TagsHelper';

type Props = {|
  tagsString: string,
  onCancel: () => void,
  onEdit: (tags: Tags) => void,
|};

type State = {|
  tagsString: string,
|};

/**
 * Dialog to edit tags, with keyboard support (auto focus of tags field,
 * enter to validate, esc to dismiss dialog).
 */
export default class EditTagsDialog extends React.Component<Props, State> {
  state = {
    tagsString: this.props.tagsString,
  };
  _tagsField = React.createRef<TextField>();

  componentDidMount() {
    setTimeout(() => {
      if (this._tagsField && this._tagsField.current) {
        this._tagsField.current.focus();
      }
    }, 10);
  }

  render() {
    const { onCancel, onEdit } = this.props;
    const { tagsString } = this.state;

    const tags = getTagsFromString(tagsString);

    return (
      <Dialog
        actions={[
          <FlatButton
            key="close"
            label={<Trans>Cancel</Trans>}
            primary={false}
            onClick={onCancel}
          />,
          <FlatButton
            key="add"
            label={
              this.props.tagsString && !tags.length ? (
                <Trans>Remove all tags</Trans>
              ) : (
                <Trans>Add/update {tags.length} tag(s)</Trans>
              )
            }
            primary
            onClick={() => onEdit(tags)}
            disabled={!this.props.tagsString && !tags.length}
          />,
        ]}
        cannotBeDismissed={true}
        open
        onRequestClose={onCancel}
      >
        <TextField
          fullWidth
          value={tagsString}
          onChange={(e, tagsString) =>
            this.setState({
              tagsString,
            })
          }
          floatingLabelText="Tag(s) (comma-separated)"
          hintText={t`For example: player, spaceship, inventory...`}
          onKeyPress={event => {
            if (event.key === 'Enter') {
              onEdit(tags);
            }
          }}
          ref={this._tagsField}
        />
      </Dialog>
    );
  }
}
