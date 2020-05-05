// @flow
import * as React from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import { ResponsiveWindowMeasurer } from '../Reponsive/ResponsiveWindowMeasurer';

const styles = {
  defaultBody: {
    overflowX: 'hidden',
  },
  noMarginBody: {
    padding: 0,
    overflowX: 'hidden',
  },
  flexRowBody: {
    display: 'flex',
    flexDirection: 'row',
  },
  flexBody: {
    display: 'flex',
  },
  actionsContainerWithSecondaryActions: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  noTitleMargin: {
    padding: 0,
  },
};

// We support a subset of the props supported by Material-UI v0.x Dialog
// They should be self descriptive - refer to Material UI docs otherwise.
type Props = {|
  open?: boolean,
  title?: React.Node,
  actions?: React.Node,
  secondaryActions?: React.Node,
  onRequestClose?: () => void,

  cannotBeDismissed?: boolean, //Force the user to use one of the actions in the Dialog. If true, the dialog can't be closed by clicking outside or pressing Escape.

  children: React.Node, // The content of the dialog

  // Display:
  flexRowBody?: boolean, //Check if necessary
  flexBody?: boolean,

  // Size
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false,

  // Style:
  noMargin?: boolean,
  noTitleMargin?: boolean,
|};

// Help Flow to understand the type of the dialog content style.
type DialogContentStyle = {
  padding?: 0,
  overflowX?: 'hidden',
  display?: 'flex',
  flexDirection?: 'row',
};

/**
 * A enhanced material-ui Dialog that can have optional secondary actions
 * and no margins if required.
 */
export default (props: Props) => {
  const {
    secondaryActions,
    actions,
    open,
    onRequestClose,
    maxWidth,
    noMargin,
    title,
    children,
    flexRowBody,
    flexBody,
    noTitleMargin,
  } = props;
  const dialogActions = secondaryActions ? (
    <React.Fragment>
      <div key="secondary-actions">{secondaryActions}</div>
      <div key="actions">{actions}</div>
    </React.Fragment>
  ) : (
    actions
  );
  const dialogContentStyle: DialogContentStyle = {
    ...(noMargin ? styles.noMarginBody : styles.defaultBody),
    ...((flexRowBody ? styles.flexRowBody : {}): DialogContentStyle),
    ...((flexBody ? styles.flexBody : {}): DialogContentStyle),
  };

  return (
    <ResponsiveWindowMeasurer>
      {size => (
        <Dialog
          open={open}
          onClose={onRequestClose}
          fullWidth
          fullScreen={size === 'small'}
          maxWidth={maxWidth !== undefined ? maxWidth : 'md'}
          disableBackdropClick={false}
          disableEscapeKeyDown={false}
        >
          {title && (
            <DialogTitle
              style={noTitleMargin ? styles.noTitleMargin : undefined}
            >
              {title}
            </DialogTitle>
          )}
          <DialogContent style={dialogContentStyle}>{children}</DialogContent>
          <DialogActions
            style={
              secondaryActions
                ? styles.actionsContainerWithSecondaryActions
                : undefined
            }
          >
            {dialogActions}
          </DialogActions>
        </Dialog>
      )}
    </ResponsiveWindowMeasurer>
  );
};
