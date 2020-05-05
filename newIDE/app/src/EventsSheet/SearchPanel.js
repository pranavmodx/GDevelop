// @flow
import { Trans } from '@lingui/macro';
import { t } from '@lingui/macro';

import React, { PureComponent } from 'react';
import Background from '../UI/Background';
import TextField from '../UI/TextField';
import { Line, Column, Spacer } from '../UI/Grid';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import IconButton from '../UI/IconButton';
import InlineCheckbox from '../UI/InlineCheckbox';
import Text from '../UI/Text';
import {
  type SearchInEventsInputs,
  type ReplaceInEventsInputs,
} from './EventsSearcher';
import RaisedButton from '../UI/RaisedButton';

type Props = {|
  onSearchInEvents: SearchInEventsInputs => void,
  onReplaceInEvents: ReplaceInEventsInputs => void,
  resultsCount: ?number,
  hasEventSelected: boolean,
  onGoToPreviousSearchResult: () => ?gdBaseEvent,
  onGoToNextSearchResult: () => ?gdBaseEvent,
|};
type State = {|
  searchText: string,
  replaceText: string,
  matchCase: boolean,
  searchInActions: boolean,
  searchInConditions: boolean,
  searchInEventStrings: boolean,
  searchInSelection: boolean,
  searchResultsDirty: boolean,
|};

export default class SearchPanel extends PureComponent<Props, State> {
  searchTextField: ?TextField;
  state = {
    searchText: '',
    replaceText: '',
    matchCase: false,
    searchInActions: true,
    searchInConditions: true,
    searchInEventStrings: true,
    searchInSelection: false,
    searchResultsDirty: false,
  };

  focus = () => {
    if (this.searchTextField) {
      this.searchTextField.focus();
    }
  };

  markSearchResultsDirty = () => {
    this.setState({ searchResultsDirty: true });
  };

  launchSearch = () => {
    const {
      searchText,
      searchInSelection,
      matchCase,
      searchInActions,
      searchInConditions,
      searchInEventStrings,
    } = this.state;
    this.props.onSearchInEvents({
      searchInSelection,
      searchText,
      matchCase,
      searchInActions,
      searchInConditions,
      searchInEventStrings,
    });
  };

  launchReplace = () => {
    const {
      searchText,
      replaceText,
      searchInSelection,
      matchCase,
      searchInActions,
      searchInConditions,
      searchInEventStrings,
    } = this.state;

    this.launchSearch();

    this.props.onReplaceInEvents({
      searchInSelection,
      searchText,
      replaceText,
      matchCase,
      searchInActions,
      searchInConditions,
      searchInEventStrings,
    });
  };

  launchSearchIfResultsDirty = () => {
    if (this.state.searchResultsDirty) {
      this.launchSearch();
      this.setState({ searchResultsDirty: false });
    }
  };

  render() {
    const {
      resultsCount,
      hasEventSelected,
      onGoToPreviousSearchResult,
      onGoToNextSearchResult,
    } = this.props;
    const { searchText, replaceText, searchInSelection } = this.state;

    return (
      <Background noFullHeight noExpand>
        <Column>
          <Line alignItems="baseline" noMargin>
            <TextField
              margin="dense"
              ref={_searchTextField =>
                (this.searchTextField = _searchTextField)
              }
              hintText={t`Text to search in parameters`}
              onChange={(e, searchText) => {
                this.setState({
                  searchText,
                  searchResultsDirty: true,
                });
              }}
              onKeyPress={event => {
                if (event.key === 'Enter') {
                  this.launchSearchIfResultsDirty();
                }
              }}
              value={searchText}
              fullWidth
            />
            <Spacer />
            <RaisedButton
              disabled={!searchText}
              primary
              label={<Trans>Search</Trans>}
              onClick={() => {
                if (!this.state.searchResultsDirty) {
                  onGoToNextSearchResult();
                } else {
                  this.launchSearchIfResultsDirty();
                }
              }}
            />
          </Line>
          <Line alignItems="baseline" noMargin>
            <TextField
              margin="dense"
              hintText={t`Text to replace in parameters`}
              onChange={(e, replaceText) => this.setState({ replaceText })}
              value={replaceText}
              fullWidth
            />
            <Spacer />
            <RaisedButton
              disabled={
                !replaceText ||
                !searchText ||
                (!hasEventSelected && searchInSelection)
              }
              label={<Trans>Replace</Trans>}
              onClick={this.launchReplace}
            />
          </Line>
          <Line noMargin alignItems="center" justifyContent="space-between">
            <Line noMargin alignItems="center">
              <InlineCheckbox
                label={<Trans>Case insensitive</Trans>}
                checked={!this.state.matchCase}
                onCheck={(e, checked) =>
                  this.setState({
                    matchCase: !checked,
                    searchResultsDirty: true,
                  })
                }
              />
              <Text>
                <Trans>Search in:</Trans>
              </Text>
              <Spacer />
              <InlineCheckbox
                label={<Trans>Conditions</Trans>}
                checked={this.state.searchInConditions}
                onCheck={(e, checked) =>
                  this.setState({
                    searchInConditions: checked,
                    searchResultsDirty: true,
                  })
                }
              />
              <InlineCheckbox
                label={<Trans>Actions</Trans>}
                checked={this.state.searchInActions}
                onCheck={(e, checked) =>
                  this.setState({
                    searchInActions: checked,
                    searchResultsDirty: true,
                  })
                }
              />
              <InlineCheckbox
                label={<Trans>Texts</Trans>}
                checked={this.state.searchInEventStrings}
                onCheck={(e, checked) =>
                  this.setState({
                    searchInEventStrings: checked,
                    searchResultsDirty: true,
                  })
                }
              />
              {/* <InlineCheckbox //TODO: Implement search/replace in selection
                label={<Trans>Replace in selection</Trans>}
                checked={this.state.searchInSelection}
                onCheck={(e, checked) =>
                  this.setState({ searchInSelection: checked })}
              /> */}
            </Line>
            <Line noMargin alignItems="center">
              <Text>
                {resultsCount === null || resultsCount === undefined
                  ? ''
                  : resultsCount !== 0
                  ? `${resultsCount} results`
                  : `No results`}
              </Text>
              <IconButton
                disabled={!resultsCount}
                onClick={() => {
                  onGoToPreviousSearchResult();
                }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                disabled={!resultsCount}
                onClick={() => {
                  onGoToNextSearchResult();
                }}
              >
                <ChevronRight />
              </IconButton>
            </Line>
          </Line>
        </Column>
      </Background>
    );
  }
}
