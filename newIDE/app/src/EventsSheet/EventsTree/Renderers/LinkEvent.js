// @flow
import { Trans } from '@lingui/macro';
import { t } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';

import * as React from 'react';
import OpenInNew from '@material-ui/icons/OpenInNew';
import IconButton from '../../../UI/IconButton';
import classNames from 'classnames';
import {
  largeSelectedArea,
  largeSelectableArea,
  selectableArea,
  linkContainer,
  disabledText,
} from '../ClassNames';
import InlinePopover from '../../InlinePopover';
import ExternalEventsField from '../../ParameterFields/ExternalEventsField';
import { showWarningBox } from '../../../UI/Messages/MessageBox';
import { type EventRendererProps } from './EventRenderer';
const gd = global.gd;

const styles = {
  container: {
    height: 60,
    display: 'flex',
    alignItems: 'center',
    padding: 5,
  },
  title: {
    fontSize: 18,
  },
};

export default class LinkEvent extends React.Component<EventRendererProps, *> {
  _externalEventsField: ?ExternalEventsField = null;

  state = {
    editing: false,
    anchorEl: null,
  };

  edit = (domEvent: any) => {
    // We should not need to use a timeout, but
    // if we don't do this, the InlinePopover's clickaway listener
    // is immediately picking up the event and closing.
    // Search the rest of the codebase for inlinepopover-event-hack
    const anchorEl = domEvent.currentTarget;
    setTimeout(
      () =>
        this.setState(
          {
            editing: true,
            anchorEl,
          },
          () => {
            // Give a bit of time for the popover to mount itself
            setTimeout(() => {
              if (this._externalEventsField) this._externalEventsField.focus();
            }, 10);
          }
        ),
      10
    );
  };

  openTarget = (i18n: I18nType) => {
    const { project, event, onOpenLayout, onOpenExternalEvents } = this.props;
    const linkEvent = gd.asLinkEvent(event);
    const target = linkEvent.getTarget();

    if (project.hasExternalEventsNamed(target)) {
      onOpenExternalEvents(target);
    } else if (project.hasLayoutNamed(target)) {
      onOpenLayout(target);
    } else {
      showWarningBox(
        i18n._(
          t`The specified external events do not exist in the game. Be sure that the name is correctly spelled or create them using the project manager.`
        )
      );
    }
  };

  endEditing = () => {
    this.setState({
      editing: false,
      anchorEl: null,
    });
  };

  render() {
    const linkEvent = gd.asLinkEvent(this.props.event);
    const target = linkEvent.getTarget();

    return (
      <I18n>
        {({ i18n }) => (
          <div
            className={classNames({
              [largeSelectableArea]: true,
              [largeSelectedArea]: this.props.selected,
              [linkContainer]: true,
            })}
            style={styles.container}
          >
            <span
              style={styles.title}
              className={classNames({
                [disabledText]: this.props.disabled,
              })}
            >
              <Trans>Include events from</Trans>{' '}
              <i
                className={classNames({
                  [selectableArea]: true,
                })}
                onClick={this.edit}
              >
                {target || (
                  <Trans>&lt; Enter the name of external events &gt;</Trans>
                )}
              </i>
            </span>
            <IconButton
              onClick={() => this.openTarget(i18n)}
              disabled={!target}
            >
              <OpenInNew />
            </IconButton>
            <InlinePopover
              open={this.state.editing}
              anchorEl={this.state.anchorEl}
              onRequestClose={this.endEditing}
            >
              <ExternalEventsField
                project={this.props.project}
                scope={this.props.scope}
                globalObjectsContainer={this.props.globalObjectsContainer}
                objectsContainer={this.props.objectsContainer}
                value={target}
                onChange={text => {
                  linkEvent.setTarget(text);
                  this.props.onUpdate();
                }}
                isInline
                ref={externalEventsField =>
                  (this._externalEventsField = externalEventsField)
                }
              />
            </InlinePopover>
          </div>
        )}
      </I18n>
    );
  }
}
