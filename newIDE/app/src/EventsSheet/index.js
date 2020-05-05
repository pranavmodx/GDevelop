// @flow
import { Trans } from '@lingui/macro';
import * as React from 'react';
import EventsTree from './EventsTree';
import NewInstructionEditorDialog from './InstructionEditor/NewInstructionEditorDialog';
import InstructionEditorDialog from './InstructionEditor/InstructionEditorDialog';
import NewInstructionEditorMenu from './InstructionEditor/NewInstructionEditorMenu';
import EventTextDialog, {
  filterEditableWithEventTextDialog,
} from './InstructionEditor/EventTextDialog';
import Toolbar from './Toolbar';
import KeyboardShortcuts from '../UI/KeyboardShortcuts';
import InlineParameterEditor from './InlineParameterEditor';
import ContextMenu from '../UI/Menu/ContextMenu';
import { type PreviewOptions } from '../Export/PreviewLauncher.flow';
import { serializeToJSObject } from '../Utils/Serializer';
import {
  type HistoryState,
  undo,
  redo,
  canUndo,
  canRedo,
  getHistoryInitialState,
  saveToHistory,
} from '../Utils/History';
import {
  type SelectionState,
  type EventContext,
  type InstructionsListContext,
  type InstructionContext,
  type ParameterContext,
  getInitialSelection,
  selectEvent,
  selectInstruction,
  hasSomethingSelected,
  hasEventSelected,
  hasInstructionSelected,
  hasSelectedAtLeastOneCondition,
  hasInstructionsListSelected,
  getSelectedEvents,
  getSelectedInstructions,
  clearSelection,
  getSelectedEventContexts,
  getSelectedInstructionsContexts,
} from './SelectionHandler';
import EmptyEventsPlaceholder from './EmptyEventsPlaceholder';
import { ensureSingleOnceInstructions } from './OnceInstructionSanitizer';
import EventsContextAnalyzerDialog, {
  type EventsContextResult,
  toEventsContextResult,
} from './EventsContextAnalyzerDialog';
import SearchPanel from './SearchPanel';
import {
  type ResourceSource,
  type ChooseResourceFunction,
} from '../ResourcesList/ResourceSource.flow';
import { type ResourceExternalEditor } from '../ResourcesList/ResourceExternalEditor.flow';
import EventsSearcher, {
  type ReplaceInEventsInputs,
  type SearchInEventsInputs,
} from './EventsSearcher';
import { containsSubInstructions } from './ContainsSubInstruction';
import {
  enumerateEventsMetadata,
  type EventMetadata,
} from './EnumerateEventsMetadata';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import EventsFunctionExtractorDialog from './EventsFunctionExtractor/EventsFunctionExtractorDialog';
import { createNewInstructionForEventsFunction } from './EventsFunctionExtractor';
import { type EventsScope } from '../InstructionOrExpression/EventsScope.flow';
import {
  pasteEventsFromClipboardInSelection,
  copySelectionToClipboard,
  pasteInstructionsFromClipboardInSelection,
  hasClipboardEvents,
  hasClipboardActions,
  hasClipboardConditions,
  pasteInstructionsFromClipboardInInstructionsList,
} from './ClipboardKind';
import InfoBar from '../UI/Messages/InfoBar';
import { ScreenTypeMeasurer } from '../UI/Reponsive/ScreenTypeMeasurer';
import { ResponsiveWindowMeasurer } from '../UI/Reponsive/ResponsiveWindowMeasurer';
import { type UnsavedChanges } from '../MainFrame/UnsavedChangesContext';
import { type PreviewButtonSettings } from '../MainFrame/Toolbar/PreviewButtons';
const gd = global.gd;

type Props = {|
  project: gdProject,
  scope: EventsScope,
  globalObjectsContainer: gdObjectsContainer,
  objectsContainer: gdObjectsContainer,
  events: gdEventsList,
  setToolbar: (?React.Node) => void,
  showPreviewButton: boolean,
  showNetworkPreviewButton: boolean,
  previewButtonSettings: PreviewButtonSettings,
  onPreview: (options: PreviewOptions) => void,
  onOpenDebugger: () => void,
  onOpenSettings?: ?() => void,
  onOpenExternalEvents: string => void,
  onOpenLayout: string => void,
  resourceSources: Array<ResourceSource>,
  onChooseResource: ChooseResourceFunction,
  resourceExternalEditors: Array<ResourceExternalEditor>,
  openInstructionOrExpression: (
    extension: gdPlatformExtension,
    type: string
  ) => void,
  onCreateEventsFunction: (
    extensionName: string,
    eventsFunction: gdEventsFunction
  ) => void,
  unsavedChanges?: UnsavedChanges,
|};
type State = {|
  history: HistoryState,

  editedInstruction: {
    //TODO: This could be adapted to be a InstructionContext
    isCondition: boolean,
    instruction: ?gdInstruction,
    instrsList: ?gdInstructionsList,
    indexInList: ?number,
  },
  editedParameter: {
    // TODO: This could be adapted to be a ParameterContext
    isCondition: boolean,
    instruction: ?gdInstruction,
    instrsList: ?gdInstructionsList,
    parameterIndex: number,
  },

  selection: SelectionState,

  inlineEditing: boolean,
  inlineEditingAnchorEl: ?HTMLElement,
  inlineInstructionEditorAnchorEl: ?HTMLElement,
  inlineEditingChangesMade: boolean,

  analyzedEventsContextResult: ?EventsContextResult,

  serializedEventsToExtract: ?Object,

  textEditedEvent: ?gdBaseEvent,

  showSearchPanel: boolean,
  searchResults: ?Array<gdBaseEvent>,
  searchFocusOffset: ?number,

  allEventsMetadata: Array<EventMetadata>,
|};

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
    flex: 1,
    position: 'relative', // To be sure that absolutely positioned PlaceholderMessage won't go outside of the EventsSheet
  },
};

export default class EventsSheet extends React.Component<Props, State> {
  _eventsTree: ?EventsTree;
  _eventSearcher: ?EventsSearcher;
  _searchPanel: ?SearchPanel;
  _containerDiv = React.createRef<HTMLDivElement>();
  _keyboardShortcuts = new KeyboardShortcuts({
    isActive: () =>
      !this.state.inlineEditing &&
      !this.state.editedInstruction.instruction &&
      !this.state.analyzedEventsContextResult &&
      !this.state.serializedEventsToExtract,
    shortcutCallbacks: {
      onDelete: () => this.deleteSelection(),
      onCopy: () => this.copySelection(),
      onCut: () => this.cutSelection(),
      onPaste: () => this.pasteEventsOrInstructions(),
      onSearch: () => this._toggleSearchPanel(),
      onEscape: () => this._closeSearchPanel(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
    },
  });

  eventContextMenu: ContextMenu;
  instructionContextMenu: ContextMenu;

  state = {
    history: getHistoryInitialState(this.props.events, { historyMaxSize: 50 }),

    editedInstruction: {
      isCondition: true,
      instruction: null,
      instrsList: null,
      indexInList: 0,
    },
    editedParameter: {
      isCondition: true,
      instruction: null,
      instrsList: null,
      parameterIndex: 0,
    },

    selection: getInitialSelection(),

    inlineEditing: false,
    inlineEditingAnchorEl: null,
    inlineInstructionEditorAnchorEl: null,
    inlineEditingChangesMade: false,

    analyzedEventsContextResult: null,

    serializedEventsToExtract: null,

    showSearchPanel: false,
    searchResults: null,
    searchFocusOffset: null,

    allEventsMetadata: [],

    textEditedEvent: null,
  };

  componentDidMount() {
    this.setState({ allEventsMetadata: enumerateEventsMetadata() });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.history !== prevState.history)
      if (this.props.unsavedChanges)
        this.props.unsavedChanges.triggerUnsavedChanges();
  }

  updateToolbar() {
    if (!this.props.setToolbar) return;

    this.props.setToolbar(
      <Toolbar
        allEventsMetadata={this.state.allEventsMetadata}
        onAddStandardEvent={() => {
          this.addNewEvent('BuiltinCommonInstructions::Standard');
        }}
        onAddSubEvent={this.addSubEvents}
        canAddSubEvent={hasEventSelected(this.state.selection)}
        onAddCommentEvent={() => {
          this.addNewEvent('BuiltinCommonInstructions::Comment');
        }}
        onAddEvent={type => {
          this.addNewEvent(type);
        }}
        canRemove={hasSomethingSelected(this.state.selection)}
        onRemove={this.deleteSelection}
        showPreviewButton={this.props.showPreviewButton}
        showNetworkPreviewButton={this.props.showNetworkPreviewButton}
        onPreview={() => this.props.onPreview({})}
        previewButtonSettings={this.props.previewButtonSettings}
        onNetworkPreview={() => this.props.onPreview({ networkPreview: true })}
        onOpenDebugger={() => {
          this.props.onOpenDebugger();
          this.props.onPreview({});
        }}
        canUndo={canUndo(this.state.history)}
        canRedo={canRedo(this.state.history)}
        undo={this.undo}
        redo={this.redo}
        onOpenSettings={this.props.onOpenSettings}
        onToggleSearchPanel={this._toggleSearchPanel}
      />
    );
  }

  _toggleSearchPanel = () => {
    this.setState(
      state => {
        const show = !state.showSearchPanel;
        if (!show) {
          if (this._eventSearcher) this._eventSearcher.reset();
        }

        return {
          showSearchPanel: show,
        };
      },
      () => {
        if (this.state.showSearchPanel && this._searchPanel) {
          this._searchPanel.focus();
        }
      }
    );
  };

  _closeSearchPanel = () => {
    this.setState({ showSearchPanel: false });
  };

  addSubEvents = () => {
    const { project } = this.props;

    getSelectedEvents(this.state.selection).forEach(event => {
      if (event.canHaveSubEvents()) {
        event
          .getSubEvents()
          .insertNewEvent(
            project,
            'BuiltinCommonInstructions::Standard',
            event.getSubEvents().getEventsCount()
          );
      }
    });

    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  _selectionCanHaveSubEvents = () => {
    return getSelectedEvents(this.state.selection).some(event => {
      return event.canHaveSubEvents();
    });
  };

  _selectionCanToggleDisabled = () => {
    return getSelectedEvents(this.state.selection).some(event => {
      return event.isExecutable();
    });
  };

  addNewEvent = (type: string, context: ?EventContext): Array<gdBaseEvent> => {
    const { project } = this.props;
    const hasEventsSelected = hasEventSelected(this.state.selection);
    let insertTopOfSelection = false;

    let insertions: Array<{
      eventsList: gdEventsList,
      indexInList: number,
    }> = [];
    if (context) {
      insertions = [context];
    } else if (hasEventsSelected) {
      if (
        type === 'BuiltinCommonInstructions::Comment' ||
        type === 'BuiltinCommonInstructions::Group'
      ) {
        insertTopOfSelection = true;
      }

      insertions = getSelectedEventContexts(this.state.selection).map(
        selectedEvent => ({
          eventsList: selectedEvent.eventsList,
          indexInList: insertTopOfSelection
            ? selectedEvent.indexInList - 1
            : selectedEvent.indexInList,
        })
      );
    } else {
      insertions = [
        {
          eventsList: this.props.events,
          indexInList: this.props.events.getEventsCount(),
        },
      ];
    }

    const newEvents = insertions.map(
      (context: { eventsList: gdEventsList, indexInList: number }) => {
        return context.eventsList.insertNewEvent(
          project,
          type,
          context.indexInList + 1
        );
      }
    );

    this._saveChangesToHistory(() => {
      const eventsTree = this._eventsTree;
      if (!eventsTree) return;

      eventsTree.forceEventsUpdate(() => {
        if (!context && !hasEventsSelected) {
          eventsTree.scrollToEvent(newEvents[0]);
        }
      });
    });

    return newEvents;
  };

  openEventTextDialog = () => {
    const editableEvents = filterEditableWithEventTextDialog(
      getSelectedEvents(this.state.selection)
    );
    if (!editableEvents.length) return;

    const event = editableEvents[editableEvents.length - 1]; // Get the last selected event.
    this.setState({
      textEditedEvent: event,
    });
  };

  closeEventTextDialog = () => {
    this.setState({
      textEditedEvent: null,
    });
  };

  openAddInstructionContextMenu = (
    button: HTMLButtonElement,
    instructionsListContext: InstructionsListContext
  ) => {
    this.openInstructionEditor(instructionsListContext, button);
  };

  openInstructionEditor = (
    instructionContext: InstructionContext | InstructionsListContext,
    inlineInstructionEditorAnchorEl?: ?HTMLButtonElement = null
  ) => {
    if (this.state.editedInstruction.instruction) {
      this.state.editedInstruction.instruction.delete();
      console.warn(
        'state.editedInstruction.instruction was containing an instruction - deleting it. Verify the logic handling the state in EventsSheet because that should not happen.'
      );
    }

    this.setState({
      inlineInstructionEditorAnchorEl,
      editedInstruction: {
        instrsList: instructionContext.instrsList,
        isCondition: instructionContext.isCondition,
        instruction: instructionContext.instruction
          ? instructionContext.instruction.clone()
          : new gd.Instruction(),
        indexInList:
          instructionContext.indexInList !== undefined
            ? instructionContext.indexInList
            : undefined,
      },
    });
  };

  closeInstructionEditor(saveChanges: boolean = false) {
    const { instruction } = this.state.editedInstruction;
    this.setState(
      {
        editedInstruction: {
          isCondition: true,
          instruction: null,
          instrsList: null,
          indexInList: 0,
        },
      },
      () => {
        // Delete from memory the instruction being edited, *after* resetting
        // editedInstruction and after the re-rendering, in an effort to be
        // sure that instruction is not used after deletion.
        if (instruction) {
          instruction.delete();
        }
        if (saveChanges) {
          this._saveChangesToHistory();
        }
      }
    );
  }

  moveSelectionToInstruction = (destinationContext: InstructionContext) => {
    this.moveSelectionToInstructionsList(
      {
        instrsList: destinationContext.instrsList,
        isCondition: destinationContext.isCondition,
      },
      destinationContext.indexInList
    );
  };

  moveSelectionToInstructionsList = (
    destinationContext: InstructionsListContext,
    indexInList: ?number = undefined
  ) => {
    const selectedInstructions = getSelectedInstructions(this.state.selection);
    const destinationIndex =
      indexInList === undefined
        ? destinationContext.instrsList.size()
        : indexInList;

    const isTryingToDragAnInstructionIntoItsOwnNestedInstructions = !!selectedInstructions.filter(
      instruction =>
        containsSubInstructions(instruction, destinationContext.instrsList)
    ).length;

    if (isTryingToDragAnInstructionIntoItsOwnNestedInstructions) return;

    selectedInstructions.forEach(instruction =>
      destinationContext.instrsList.insert(instruction, destinationIndex)
    );

    if (!this._keyboardShortcuts.shouldCloneInstances()) {
      this.deleteSelection({ deleteEvents: false });
    } else {
      this._saveChangesToHistory();
    }
  };

  selectEvent = (eventContext: EventContext) => {
    const multiSelect = this._keyboardShortcuts.shouldMultiSelect();
    this.setState(
      {
        selection: selectEvent(this.state.selection, eventContext, multiSelect),
      },
      () => this.updateToolbar()
    );
  };

  openEventContextMenu = (x: number, y: number, eventContext: EventContext) => {
    const multiSelect = this._keyboardShortcuts.shouldMultiSelect();
    this.setState(
      {
        selection: selectEvent(this.state.selection, eventContext, multiSelect),
      },
      () => {
        this.updateToolbar();
        this.eventContextMenu.open(x, y);
      }
    );
  };

  openInstructionContextMenu = (
    x: number,
    y: number,
    instructionContext: InstructionContext
  ) => {
    const multiSelect = this._keyboardShortcuts.shouldMultiSelect();
    this.setState(
      {
        selection: selectInstruction(
          this.state.selection,
          instructionContext,
          multiSelect
        ),
      },
      () => {
        this.updateToolbar();
        this.instructionContextMenu.open(x, y);
      }
    );
  };

  selectInstruction = (instructionContext: InstructionContext) => {
    const multiSelect = this._keyboardShortcuts.shouldMultiSelect();
    this.setState(
      {
        selection: selectInstruction(
          this.state.selection,
          instructionContext,
          multiSelect
        ),
      },
      () => this.updateToolbar()
    );
  };

  openParameterEditor = (parameterContext: ParameterContext) => {
    // $FlowFixMe
    this.setState({
      editedParameter: parameterContext,
      inlineEditing: true,
      inlineEditingAnchorEl: parameterContext.domEvent
        ? parameterContext.domEvent.currentTarget
        : null,
      inlineEditingChangesMade: false,
    });
  };

  closeParameterEditor = () => {
    if (this.state.inlineEditingChangesMade) {
      this._saveChangesToHistory();
    }

    this.setState({
      inlineEditing: false,
      inlineEditingAnchorEl: null,
      inlineEditingChangesMade: false,
    });
  };

  toggleDisabled = () => {
    getSelectedEvents(this.state.selection).forEach(event =>
      event.setDisabled(!event.isDisabled())
    );
    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  deleteSelection = ({
    deleteInstructions = true,
    deleteEvents = true,
  }: { deleteInstructions?: boolean, deleteEvents?: boolean } = {}) => {
    const { events } = this.props;
    const eventsRemover = new gd.EventsRemover();
    if (deleteEvents) {
      getSelectedEvents(this.state.selection).forEach(event =>
        eventsRemover.addEventToRemove(event)
      );
    }
    if (deleteInstructions) {
      getSelectedInstructions(this.state.selection).forEach(instruction =>
        eventsRemover.addInstructionToRemove(instruction)
      );
    }

    eventsRemover.launch(events);

    // /!\ Events were changed, so any reference to an existing event can now
    // be invalid. Make sure to immediately trigger a forced update before
    // any re-render that could use a deleted/invalid event.
    if (this._eventsTree) this._eventsTree.forceEventsUpdate();

    this.setState(
      {
        selection: clearSelection(),
        inlineEditing: false,
        inlineEditingAnchorEl: null,
      },
      () => {
        this._saveChangesToHistory();

        // Deletion of an event/instruction will remove it from the DOM,
        // potentially losing the focus on the associated DOM elements. Ensure
        // we keep the focus on the EventsSheet.
        this._ensureFocused();
      }
    );
  };

  copySelection = () => {
    copySelectionToClipboard(this.state.selection);
  };

  cutSelection = () => {
    this.copySelection();
    this.deleteSelection();
  };

  pasteEvents = () => {
    if (
      !pasteEventsFromClipboardInSelection(
        this.props.project,
        this.state.selection
      )
    ) {
      return;
    }

    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  pasteInstructions = () => {
    if (
      !pasteInstructionsFromClipboardInSelection(
        this.props.project,
        this.state.selection
      )
    ) {
      return;
    }

    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  pasteEventsOrInstructions = () => {
    if (hasEventSelected(this.state.selection)) this.pasteEvents();
    else if (hasInstructionSelected(this.state.selection))
      this.pasteInstructions();
    else if (hasInstructionsListSelected(this.state.selection))
      this.pasteInstructions();
  };

  pasteInstructionsInInstructionsList = (
    instructionsListContext: InstructionsListContext
  ) => {
    if (
      !pasteInstructionsFromClipboardInInstructionsList(
        this.props.project,
        instructionsListContext
      )
    ) {
      return;
    }

    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  _invertSelectedConditions = () => {
    getSelectedInstructionsContexts(this.state.selection).forEach(
      instructionContext => {
        if (instructionContext.isCondition) {
          instructionContext.instruction.setInverted(
            !instructionContext.instruction.isInverted()
          );
        }
      }
    );

    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  _saveChangesToHistory = (cb: ?Function) => {
    this.setState(
      {
        history: saveToHistory(this.state.history, this.props.events),
      },
      () => {
        this.updateToolbar();
        if (cb) cb();
      }
    );
    if (this._searchPanel) this._searchPanel.markSearchResultsDirty();
  };

  undo = () => {
    if (!canUndo(this.state.history)) return;

    const { events, project } = this.props;
    const newHistory = undo(this.state.history, events, project);

    // /!\ Events were changed, so any reference to an existing event can now
    // be invalid. Make sure to immediately trigger a forced update before
    // any re-render that could use a deleted/invalid event.
    if (this._eventsTree) this._eventsTree.forceEventsUpdate();

    // /!\ Also clear selection, that can contain reference to invalid events or
    // events not shown on screen.
    this.setState({ history: newHistory, selection: clearSelection() }, () =>
      this.updateToolbar()
    );
  };

  redo = () => {
    if (!canRedo(this.state.history)) return;

    const { events, project } = this.props;
    const newHistory = redo(this.state.history, events, project);

    // /!\ Events were changed, so any reference to an existing event can now
    // be invalid. Make sure to immediately trigger a forced update before
    // any re-render that could use a deleted/invalid event.
    if (this._eventsTree) this._eventsTree.forceEventsUpdate();

    // /!\ Also clear selection, that can contain reference to invalid events or
    // events not shown on screen.
    this.setState({ history: newHistory, selection: clearSelection() }, () =>
      this.updateToolbar()
    );
  };

  _openEventsContextAnalyzer = () => {
    const { globalObjectsContainer, objectsContainer } = this.props;
    const eventsContextAnalyzer = new gd.EventsContextAnalyzer(
      gd.JsPlatform.get(),
      globalObjectsContainer,
      objectsContainer
    );

    const eventsList = new gd.EventsList();
    getSelectedEvents(this.state.selection).forEach(event =>
      eventsList.insertEvent(event, eventsList.getEventsCount())
    );

    eventsContextAnalyzer.launch(eventsList);
    eventsList.delete();

    this.setState({
      analyzedEventsContextResult: toEventsContextResult(
        eventsContextAnalyzer.getEventsContext()
      ),
    });
    eventsContextAnalyzer.delete();
  };

  _closeEventsContextAnalyzer = () => {
    this.setState({
      analyzedEventsContextResult: null,
    });
  };

  extractEventsToFunction = () => {
    const eventsList = new gd.EventsList();

    getSelectedEvents(this.state.selection).forEach(event =>
      eventsList.insertEvent(event, eventsList.getEventsCount())
    );

    this.setState({
      serializedEventsToExtract: serializeToJSObject(eventsList),
    });

    eventsList.delete();
  };

  moveEventsIntoNewGroup = () => {
    const eventsList = new gd.EventsList();

    getSelectedEvents(this.state.selection).forEach(event =>
      eventsList.insertEvent(event, eventsList.getEventsCount())
    );

    this._replaceSelectionByGroupOfEvents(eventsList);
    eventsList.delete();
  };

  _replaceSelectionByEventsFunction = (
    extensionName: string,
    eventsFunction: gdEventsFunction
  ) => {
    const contexts = getSelectedEventContexts(this.state.selection);
    if (!contexts.length) return;

    const newEvents = this.addNewEvent(
      'BuiltinCommonInstructions::Standard',
      contexts[0]
    );
    if (!newEvents.length) {
      console.error('A new event should have been created');
      return;
    }

    const action = createNewInstructionForEventsFunction(
      extensionName,
      eventsFunction
    );
    const standardEvt = gd.asStandardEvent(newEvents[0]);
    standardEvt.getActions().push_back(action);
    action.delete();

    this.deleteSelection({ deleteInstructions: false });
  };

  _replaceSelectionByGroupOfEvents = (eventsList: gdEventsList) => {
    const contexts = getSelectedEventContexts(this.state.selection);
    if (!contexts.length) return;

    const newEvents = this.addNewEvent(
      'BuiltinCommonInstructions::Group',
      contexts[0]
    );
    if (!newEvents.length) {
      console.error('A new event should have been created');
      return;
    }

    const groupEvent = gd.asGroupEvent(newEvents[0]);

    groupEvent.setName('Grouped events');
    groupEvent.setFolded(true);
    groupEvent
      .getSubEvents()
      .insertEvents(eventsList, 0, eventsList.getEventsCount(), 0);

    this.deleteSelection({ deleteInstructions: false });
  };

  _ensureEventUnfolded = (cb: () => ?gdBaseEvent) => {
    const event = cb();
    if (event && this._eventsTree) {
      this._eventsTree.unfoldForEvent(event);
    }
  };

  _replaceInEvents = (
    doReplaceInEvents: (inputs: ReplaceInEventsInputs) => void,
    inputs: ReplaceInEventsInputs
  ) => {
    doReplaceInEvents(inputs);
    this._saveChangesToHistory(() => {
      if (this._eventsTree) this._eventsTree.forceEventsUpdate();
    });
  };

  _searchInEvents = (
    doSearchInEvents: (inputs: SearchInEventsInputs, cb: () => void) => void,
    inputs: SearchInEventsInputs
  ) => {
    doSearchInEvents(inputs, () => {
      this.forceUpdate(() => {
        if (this._eventsTree) this._eventsTree.forceEventsUpdate();
      });
    });
  };

  _onEventMoved = () => {
    // Move of the event in the list is handled by EventsTree.
    // This could be refactored and put here if the drag'n'drop of events
    // is reworked at some point.
    this._saveChangesToHistory();
  };

  _renderInstructionEditorDialog = (newInstructionEditorDialog: boolean) => {
    const {
      project,
      scope,
      globalObjectsContainer,
      objectsContainer,
    } = this.props;

    // Choose the dialog to use
    const Dialog = this.state.inlineInstructionEditorAnchorEl
      ? NewInstructionEditorMenu
      : newInstructionEditorDialog
      ? NewInstructionEditorDialog
      : InstructionEditorDialog;

    return this.state.editedInstruction.instruction ? (
      <Dialog
        project={project}
        scope={scope}
        globalObjectsContainer={globalObjectsContainer}
        objectsContainer={objectsContainer}
        instruction={this.state.editedInstruction.instruction}
        isCondition={this.state.editedInstruction.isCondition}
        isNewInstruction={
          this.state.editedInstruction.indexInList === undefined
        }
        anchorEl={this.state.inlineInstructionEditorAnchorEl}
        open={true}
        onCancel={() => this.closeInstructionEditor()}
        onSubmit={() => {
          const {
            instrsList,
            instruction,
            indexInList,
          } = this.state.editedInstruction;
          if (!instrsList) return;

          if (indexInList !== undefined) {
            // Replace an existing instruction
            instrsList.set(indexInList, instruction);
          } else {
            // Add a new instruction
            instrsList.insert(instruction, instrsList.size());
          }

          this.closeInstructionEditor(true);
          ensureSingleOnceInstructions(instrsList);
          if (this._eventsTree) this._eventsTree.forceEventsUpdate();
        }}
        resourceSources={this.props.resourceSources}
        onChooseResource={this.props.onChooseResource}
        resourceExternalEditors={this.props.resourceExternalEditors}
        openInstructionOrExpression={(extension, type) => {
          this.closeInstructionEditor();
          this.props.openInstructionOrExpression(extension, type);
        }}
      />
    ) : (
      undefined
    );
  };

  /**
   * Call this to ensure that the events sheet stays focused after a potential
   * lost of focus (for example, after a scroll, the focused element might have
   * been scrolled out of the view and so removed from the DOM)
   */
  _ensureFocused = () => {
    if (!this._containerDiv || !document) return;

    const containerDivElement = this._containerDiv.current;
    if (document.activeElement === containerDivElement) {
      // Focus is already on the container
      return;
    }
    if (containerDivElement) {
      if (
        document.activeElement !== document.body &&
        containerDivElement.contains(document.activeElement)
      ) {
        // Focus is already on an element of the container
        return;
      }

      // Focus is not on an element of the container, we probably lost the focus
      // after scrolling or removing an element. Give back the focus to the container.
      containerDivElement.focus();
    }
  };

  render() {
    const {
      project,
      scope,
      events,
      onOpenExternalEvents,
      onOpenLayout,
      globalObjectsContainer,
      objectsContainer,
    } = this.props;
    if (!project) return null;

    return (
      <ScreenTypeMeasurer>
        {screenType => (
          <ResponsiveWindowMeasurer>
            {windowWidth => (
              <PreferencesContext.Consumer>
                {({ values }) => (
                  <EventsSearcher
                    key={events.ptr}
                    ref={eventSearcher => (this._eventSearcher = eventSearcher)}
                    events={events}
                    globalObjectsContainer={globalObjectsContainer}
                    objectsContainer={objectsContainer}
                    selection={this.state.selection}
                  >
                    {({
                      eventsSearchResultEvents,
                      searchFocusOffset,
                      searchInEvents,
                      replaceInEvents,
                      goToPreviousSearchResult,
                      goToNextSearchResult,
                    }) => (
                      <div
                        className="gd-events-sheet"
                        style={styles.container}
                        onKeyDown={this._keyboardShortcuts.onKeyDown}
                        onKeyUp={this._keyboardShortcuts.onKeyUp}
                        onDragOver={this._keyboardShortcuts.onDragOver}
                        ref={this._containerDiv}
                        tabIndex={0}
                      >
                        <EventsTree
                          ref={eventsTree => (this._eventsTree = eventsTree)}
                          key={events.ptr}
                          onScroll={this._ensureFocused}
                          events={events}
                          project={project}
                          scope={scope}
                          globalObjectsContainer={globalObjectsContainer}
                          objectsContainer={objectsContainer}
                          selection={this.state.selection}
                          onInstructionClick={this.selectInstruction}
                          onInstructionDoubleClick={this.openInstructionEditor}
                          onInstructionContextMenu={
                            this.openInstructionContextMenu
                          }
                          onAddInstructionContextMenu={
                            this.openAddInstructionContextMenu
                          }
                          onAddNewInstruction={this.openInstructionEditor}
                          onPasteInstructions={
                            this.pasteInstructionsInInstructionsList
                          }
                          onMoveToInstruction={this.moveSelectionToInstruction}
                          onMoveToInstructionsList={
                            this.moveSelectionToInstructionsList
                          }
                          onParameterClick={this.openParameterEditor}
                          onEventClick={this.selectEvent}
                          onEventContextMenu={this.openEventContextMenu}
                          onAddNewEvent={context => {
                            this.addNewEvent(
                              'BuiltinCommonInstructions::Standard',
                              context
                            );
                          }}
                          onOpenExternalEvents={onOpenExternalEvents}
                          onOpenLayout={onOpenLayout}
                          searchResults={eventsSearchResultEvents}
                          searchFocusOffset={searchFocusOffset}
                          onEventMoved={this._onEventMoved}
                          showObjectThumbnails={
                            values.eventsSheetShowObjectThumbnails
                          }
                          screenType={screenType}
                          windowWidth={windowWidth}
                        />
                        {this.state.showSearchPanel && (
                          <SearchPanel
                            ref={searchPanel =>
                              (this._searchPanel = searchPanel)
                            }
                            onSearchInEvents={inputs =>
                              this._searchInEvents(searchInEvents, inputs)
                            }
                            onReplaceInEvents={inputs =>
                              this._replaceInEvents(replaceInEvents, inputs)
                            }
                            resultsCount={
                              eventsSearchResultEvents
                                ? eventsSearchResultEvents.length
                                : null
                            }
                            hasEventSelected={hasEventSelected(
                              this.state.selection
                            )}
                            onGoToPreviousSearchResult={() =>
                              this._ensureEventUnfolded(
                                goToPreviousSearchResult
                              )
                            }
                            onGoToNextSearchResult={() =>
                              this._ensureEventUnfolded(goToNextSearchResult)
                            }
                          />
                        )}
                        {events && events.getEventsCount() === 0 && (
                          <EmptyEventsPlaceholder />
                        )}
                        <InlineParameterEditor
                          open={this.state.inlineEditing}
                          anchorEl={this.state.inlineEditingAnchorEl}
                          onRequestClose={this.closeParameterEditor}
                          project={project}
                          scope={scope}
                          globalObjectsContainer={globalObjectsContainer}
                          objectsContainer={objectsContainer}
                          isCondition={this.state.editedParameter.isCondition}
                          instruction={this.state.editedParameter.instruction}
                          parameterIndex={
                            this.state.editedParameter.parameterIndex
                          }
                          onChange={value => {
                            const {
                              instruction,
                              parameterIndex,
                            } = this.state.editedParameter;
                            if (!instruction) return;
                            instruction.setParameter(parameterIndex, value);
                            this.setState({
                              inlineEditingChangesMade: true,
                            });
                            if (this._searchPanel)
                              this._searchPanel.markSearchResultsDirty();
                          }}
                          resourceSources={this.props.resourceSources}
                          onChooseResource={this.props.onChooseResource}
                          resourceExternalEditors={
                            this.props.resourceExternalEditors
                          }
                        />
                        <ContextMenu
                          ref={eventContextMenu =>
                            (this.eventContextMenu = eventContextMenu)
                          }
                          buildMenuTemplate={() => [
                            {
                              label: 'Edit',
                              click: () => this.openEventTextDialog(),
                              visible:
                                filterEditableWithEventTextDialog(
                                  getSelectedEvents(this.state.selection)
                                ).length > 0,
                            },
                            {
                              label: 'Copy',
                              click: () => this.copySelection(),
                              accelerator: 'CmdOrCtrl+C',
                            },
                            {
                              label: 'Cut',
                              click: () => this.cutSelection(),
                              accelerator: 'CmdOrCtrl+X',
                            },
                            {
                              label: 'Paste',
                              click: () => this.pasteEvents(),
                              enabled: hasClipboardEvents(),
                              accelerator: 'CmdOrCtrl+V',
                            },
                            {
                              label: 'Delete',
                              click: () => this.deleteSelection(),
                              accelerator: 'Delete',
                            },
                            {
                              label: 'Toggle disabled',
                              click: () => this.toggleDisabled(),
                              enabled: this._selectionCanToggleDisabled(),
                            },
                            { type: 'separator' },
                            {
                              label: 'Add New Event Below',
                              click: () =>
                                this.addNewEvent(
                                  'BuiltinCommonInstructions::Standard'
                                ),
                            },
                            {
                              label: 'Add Sub Event',
                              click: () => this.addSubEvents(),
                              enabled: this._selectionCanHaveSubEvents(),
                            },
                            {
                              label: 'Add Other',
                              submenu: this.state.allEventsMetadata.map(
                                metadata => {
                                  return {
                                    label: metadata.fullName,
                                    click: () =>
                                      this.addNewEvent(metadata.type),
                                  };
                                }
                              ),
                            },
                            { type: 'separator' },
                            {
                              label: 'Undo',
                              click: this.undo,
                              enabled: canUndo(this.state.history),
                              accelerator: 'CmdOrCtrl+Z',
                            },
                            {
                              label: 'Redo',
                              click: this.redo,
                              enabled: canRedo(this.state.history),
                              accelerator: 'CmdOrCtrl+Shift+Z',
                            },
                            { type: 'separator' },
                            {
                              label: 'Extract Events to a Function',
                              click: () => this.extractEventsToFunction(),
                            },
                            {
                              label: 'Move Events into a Group',
                              click: () => this.moveEventsIntoNewGroup(),
                            },
                            {
                              label: 'Analyze Objects Used in this Event',
                              click: this._openEventsContextAnalyzer,
                            },
                          ]}
                        />
                        <ContextMenu
                          ref={instructionContextMenu =>
                            (this.instructionContextMenu = instructionContextMenu)
                          }
                          buildMenuTemplate={() => [
                            {
                              label: 'Copy',
                              click: () => this.copySelection(),
                              accelerator: 'CmdOrCtrl+C',
                            },
                            {
                              label: 'Cut',
                              click: () => this.cutSelection(),
                              accelerator: 'CmdOrCtrl+X',
                            },
                            {
                              label: 'Paste',
                              click: () => this.pasteInstructions(),
                              enabled:
                                hasClipboardConditions() ||
                                hasClipboardActions(),
                              accelerator: 'CmdOrCtrl+V',
                            },
                            { type: 'separator' },
                            {
                              label: 'Delete',
                              click: () => this.deleteSelection(),
                              accelerator: 'Delete',
                            },
                            { type: 'separator' },
                            {
                              label: 'Undo',
                              click: this.undo,
                              enabled: canUndo(this.state.history),
                              accelerator: 'CmdOrCtrl+Z',
                            },
                            {
                              label: 'Redo',
                              click: this.redo,
                              enabled: canRedo(this.state.history),
                              accelerator: 'CmdOrCtrl+Shift+Z',
                            },
                            {
                              label: 'Invert Condition',
                              click: () => this._invertSelectedConditions(),
                              visible: hasSelectedAtLeastOneCondition(
                                this.state.selection
                              ),
                            },
                          ]}
                        />
                        {this._renderInstructionEditorDialog(
                          // Force using the new instruction editor on touch screens.
                          values.useNewInstructionEditorDialog ||
                            screenType === 'touch'
                        )}
                        {this.state.analyzedEventsContextResult && (
                          <EventsContextAnalyzerDialog
                            onClose={this._closeEventsContextAnalyzer}
                            eventsContextResult={
                              this.state.analyzedEventsContextResult
                            }
                          />
                        )}
                        {this.state.serializedEventsToExtract && (
                          <EventsFunctionExtractorDialog
                            project={project}
                            globalObjectsContainer={globalObjectsContainer}
                            objectsContainer={objectsContainer}
                            onClose={() =>
                              this.setState({
                                serializedEventsToExtract: null,
                              })
                            }
                            serializedEvents={
                              this.state.serializedEventsToExtract
                            }
                            onCreate={(extensionName, eventsFunction) => {
                              this.props.onCreateEventsFunction(
                                extensionName,
                                eventsFunction
                              );
                              this._replaceSelectionByEventsFunction(
                                extensionName,
                                eventsFunction
                              );
                              this.setState({
                                serializedEventsToExtract: null,
                              });
                            }}
                          />
                        )}
                        {this.state.textEditedEvent && (
                          <EventTextDialog
                            event={this.state.textEditedEvent}
                            onApply={() => {
                              this.closeEventTextDialog();
                              this._saveChangesToHistory();
                            }}
                            onClose={this.closeEventTextDialog}
                          />
                        )}
                        <InfoBar
                          identifier="edit-instruction-explanation"
                          message={
                            <Trans>
                              Double click on a condition or action to edit it.
                            </Trans>
                          }
                          touchScreenMessage={
                            <Trans>
                              Double tap a condition or action to edit it. Long
                              press to show more options.
                            </Trans>
                          }
                          show={hasInstructionSelected(this.state.selection)}
                        />
                      </div>
                    )}
                  </EventsSearcher>
                )}
              </PreferencesContext.Consumer>
            )}
          </ResponsiveWindowMeasurer>
        )}
      </ScreenTypeMeasurer>
    );
  }
}
