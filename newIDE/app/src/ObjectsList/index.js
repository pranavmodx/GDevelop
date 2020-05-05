// @flow
import { Trans } from '@lingui/macro';

import React from 'react';
import { AutoSizer } from 'react-virtualized';
import SortableVirtualizedItemList from '../UI/SortableVirtualizedItemList';
import Background from '../UI/Background';
import SearchBar from '../UI/SearchBar';
import NewObjectDialog from './NewObjectDialog';
import VariablesEditorDialog from '../VariablesList/VariablesEditorDialog';
import newNameGenerator from '../Utils/NewNameGenerator';
import Clipboard from '../Utils/Clipboard';
import Window from '../Utils/Window';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../Utils/Serializer';
import { showWarningBox } from '../UI/Messages/MessageBox';
import {
  enumerateObjects,
  filterObjectsList,
  isSameObjectWithContext,
} from './EnumerateObjects';
import type {
  ObjectWithContextList,
  ObjectWithContext,
} from '../ObjectsList/EnumerateObjects';
import { CLIPBOARD_KIND } from './ClipboardKind';
import TagChips from '../UI/TagChips';
import EditTagsDialog from '../UI/EditTagsDialog';
import {
  type Tags,
  type SelectedTags,
  getStringFromTags,
  buildTagsMenuTemplate,
  getTagsFromString,
} from '../Utils/TagsHelper';
import { type UnsavedChanges } from '../MainFrame/UnsavedChangesContext';

const styles = {
  listContainer: {
    flex: 1,
  },
};

export const objectWithContextReactDndType = 'GD_OBJECT_WITH_CONTEXT';

const getObjectWithContextName = (objectWithContext: ObjectWithContext) =>
  objectWithContext.object.getName();

const isObjectWithContextGlobal = (objectWithContext: ObjectWithContext) =>
  objectWithContext.global;

const getPasteLabel = isGlobalObject => {
  let clipboardObjectName = '';
  if (Clipboard.has(CLIPBOARD_KIND)) {
    const clipboardContent = Clipboard.get(CLIPBOARD_KIND);
    if (clipboardContent) {
      clipboardObjectName = clipboardContent.name;
    }
  }

  return isGlobalObject
    ? 'Paste ' + clipboardObjectName + ' as a Global Object'
    : 'Paste ' + clipboardObjectName;
};

type State = {|
  newObjectDialogOpen: boolean,
  renamedObjectWithContext: ?ObjectWithContext,
  variablesEditedObject: ?gdObject,
  searchText: string,
  tagEditedObject: ?gdObject,
|};

type Props = {|
  project: gdProject,
  objectsContainer: gdObjectsContainer,
  onDeleteObject: (
    objectWithContext: ObjectWithContext,
    cb: (boolean) => void
  ) => void,
  onRenameObject: (
    objectWithContext: ObjectWithContext,
    newName: string,
    cb: (boolean) => void
  ) => void,
  selectedObjectNames: Array<string>,

  selectedObjectTags: SelectedTags,
  getAllObjectTags: () => Tags,
  onChangeSelectedObjectTags: SelectedTags => void,

  onEditObject: gdObject => void,
  onObjectCreated: string => void,
  onObjectSelected: string => void,
  onObjectPasted?: gdObject => void,
  canRenameObject: (newName: string) => boolean,

  getThumbnail: (project: gdProject, object: Object) => string,
  unsavedChanges?: UnsavedChanges,
|};

export default class ObjectsList extends React.Component<Props, State> {
  sortableList: ?SortableVirtualizedItemList<ObjectWithContext>;
  _displayedObjectWithContextsList: ObjectWithContextList = [];
  state = {
    newObjectDialogOpen: false,
    renamedObjectWithContext: null,
    variablesEditedObject: null,
    searchText: '',
    tagEditedObject: null,
  };

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    // The component is costly to render, so avoid any re-rendering as much
    // as possible.
    // We make the assumption that no changes to objects list is made outside
    // from the component.
    // If a change is made, the component won't notice it: you have to manually
    // call forceUpdate.

    if (
      this.state.newObjectDialogOpen !== nextState.newObjectDialogOpen ||
      this.state.renamedObjectWithContext !==
        nextState.renamedObjectWithContext ||
      this.state.variablesEditedObject !== nextState.variablesEditedObject ||
      this.state.searchText !== nextState.searchText ||
      this.state.tagEditedObject !== nextState.tagEditedObject
    )
      return true;

    if (
      this.props.selectedObjectNames !== nextProps.selectedObjectNames ||
      this.props.selectedObjectTags !== nextProps.selectedObjectTags
    )
      return true;

    if (
      this.props.project !== nextProps.project ||
      this.props.objectsContainer !== nextProps.objectsContainer
    )
      return true;

    return false;
  }

  addObject = (objectType: string) => {
    const {
      project,
      objectsContainer,
      onEditObject,
      onObjectCreated,
      onObjectSelected,
    } = this.props;

    const name = newNameGenerator(
      'NewObject',
      name =>
        objectsContainer.hasObjectNamed(name) || project.hasObjectNamed(name)
    );

    const object = objectsContainer.insertNewObject(
      project,
      objectType,
      name,
      objectsContainer.getObjectsCount()
    );
    object.setTags(getStringFromTags(this.props.selectedObjectTags));

    this.setState(
      {
        newObjectDialogOpen: false,
      },
      () => {
        if (onEditObject) {
          onEditObject(object);
          onObjectCreated(name);
          onObjectSelected(name);
        }
      }
    );
  };

  onAddNewObject = () => {
    this.setState({ newObjectDialogOpen: true });
  };

  _deleteObject = (objectWithContext: ObjectWithContext) => {
    const { object, global } = objectWithContext;
    const { project, objectsContainer } = this.props;

    const answer = Window.showConfirmDialog(
      "Are you sure you want to remove this object? This can't be undone."
    );
    if (!answer) return;

    // It's important to call onDeleteObject, because the parent might
    // have to do some refactoring/clean up work before the object is deleted
    // (typically, the SceneEditor will remove instances refering to the object,
    // leading to the removal of their renderer - which can keep a reference to
    // the object).
    this.props.onDeleteObject(objectWithContext, doRemove => {
      if (!doRemove) return;

      if (global) {
        project.removeObject(object.getName());
      } else {
        objectsContainer.removeObject(object.getName());
      }

      this._onObjectModified(false);
    });
  };

  _copyObject = (objectWithContext: ObjectWithContext) => {
    const { object } = objectWithContext;
    Clipboard.set(CLIPBOARD_KIND, {
      type: object.getType(),
      name: object.getName(),
      object: serializeToJSObject(object),
    });
  };

  _cutObject = (objectWithContext: ObjectWithContext) => {
    this._copyObject(objectWithContext);
    this._deleteObject(objectWithContext);
  };

  _duplicateObject = (objectWithContext: ObjectWithContext) => {
    this._copyObject(objectWithContext);
    this._pasteAndRename(objectWithContext);
  };

  _pasteAndRename = (objectWithContext: ObjectWithContext) => {
    this._editName(this._paste(objectWithContext));
  };

  _paste = (objectWithContext: ObjectWithContext): ?ObjectWithContext => {
    if (!Clipboard.has(CLIPBOARD_KIND)) return null;

    const { object: pasteObject, global } = objectWithContext;
    const { object: copiedObject, type, name } = Clipboard.get(CLIPBOARD_KIND);
    const { project, objectsContainer, onObjectPasted } = this.props;

    const newName = newNameGenerator(
      name,
      name =>
        objectsContainer.hasObjectNamed(name) || project.hasObjectNamed(name),
      ''
    );

    const newObject = global
      ? project.insertNewObject(
          project,
          type,
          newName,
          project.getObjectPosition(pasteObject.getName())
        )
      : objectsContainer.insertNewObject(
          project,
          type,
          newName,
          objectsContainer.getObjectPosition(pasteObject.getName())
        );

    unserializeFromJSObject(
      newObject,
      copiedObject,
      'unserializeFrom',
      project
    );
    newObject.setName(newName); // Unserialization has overwritten the name.

    this._onObjectModified(false);
    if (onObjectPasted) onObjectPasted(newObject);

    return { object: newObject, global };
  };

  _editName = (objectWithContext: ?ObjectWithContext) => {
    this.setState(
      {
        renamedObjectWithContext: objectWithContext,
      },
      () => {
        if (this.sortableList) this.sortableList.forceUpdateGrid();
      }
    );
  };

  _editVariables = (object: ?gdObject) => {
    this.setState({
      variablesEditedObject: object,
    });
  };

  _rename = (objectWithContext: ObjectWithContext, newName: string) => {
    const { object } = objectWithContext;
    this.setState({
      renamedObjectWithContext: null,
    });

    if (getObjectWithContextName(objectWithContext) === newName) return;

    if (this.props.canRenameObject(newName)) {
      this.props.onRenameObject(objectWithContext, newName, doRename => {
        if (!doRename) return;

        object.setName(newName);
        this._onObjectModified(false);
      });
    }
  };

  _canMoveSelectionTo = (destinationObjectWithContext: ObjectWithContext) => {
    // Check if at least one element in the selection can be moved.
    const selectedObjects = this._displayedObjectWithContextsList.filter(
      objectWithContext =>
        this.props.selectedObjectNames.indexOf(
          objectWithContext.object.getName()
        ) !== -1
    );
    return (
      selectedObjects.filter(movedObjectWithContext => {
        return (
          movedObjectWithContext.global === destinationObjectWithContext.global
        );
      }).length > 0
    );
  };

  _moveSelectionTo = (destinationObjectWithContext: ObjectWithContext) => {
    const { project, objectsContainer } = this.props;

    const container: gdObjectsContainer = destinationObjectWithContext.global
      ? project
      : objectsContainer;

    const selectedObjects = this._displayedObjectWithContextsList.filter(
      objectWithContext =>
        this.props.selectedObjectNames.indexOf(
          objectWithContext.object.getName()
        ) !== -1
    );
    selectedObjects.forEach(movedObjectWithContext => {
      if (
        movedObjectWithContext.global !== destinationObjectWithContext.global
      ) {
        // Can't move an object from the objects container to the global objects
        // or vice-versa.
        return;
      }

      container.moveObject(
        container.getObjectPosition(movedObjectWithContext.object.getName()),
        container.getObjectPosition(
          destinationObjectWithContext.object.getName()
        )
      );
    });
    this._onObjectModified(true);
  };

  _setAsGlobalObject = (objectWithContext: ObjectWithContext) => {
    const { object } = objectWithContext;
    const { project, objectsContainer } = this.props;

    const objectName: string = object.getName();
    if (!objectsContainer.hasObjectNamed(objectName)) return;

    if (project.hasObjectNamed(objectName)) {
      showWarningBox(
        'A global object with this name already exists. Please change the object name before setting it as a global object'
      );
      return;
    }

    const answer = Window.showConfirmDialog(
      "This object will be loaded and available in all the scenes. This is only recommended for objects that you reuse a lot and can't be undone. Make this object global?"
    );
    if (!answer) return;

    // It's safe to call moveObjectToAnotherContainer because it does not invalidate the
    // references to the object in memory - so other editors like InstancesRenderer can
    // continue to work.
    objectsContainer.moveObjectToAnotherContainer(
      objectName,
      project,
      project.getObjectsCount()
    );
    this._onObjectModified(true);
  };

  forceUpdateList = () => {
    this.forceUpdate();
    if (this.sortableList) this.sortableList.forceUpdateGrid();
  };

  _openEditTagDialog = (tagEditedObject: ?gdObject) => {
    this.setState({
      tagEditedObject,
    });
  };

  _changeObjectTags = (object: gdObject, tags: Tags) => {
    object.setTags(getStringFromTags(tags));

    // Force update the list as it's possible that user removed a tag
    // from an object, that should then not be shown anymore in the list.
    this._onObjectModified(true);
  };

  _selectObject = (objectWithContext: ?ObjectWithContext) => {
    this.props.onObjectSelected(
      objectWithContext ? objectWithContext.object.getName() : ''
    );
  };

  _getObjectThumbnail = (objectWithContext: ObjectWithContext) =>
    this.props.getThumbnail(this.props.project, objectWithContext.object);

  _renderObjectMenuTemplate = (
    objectWithContext: ObjectWithContext,
    index: number
  ) => {
    const { object } = objectWithContext;
    return [
      {
        label: 'Edit object',
        click: () => this.props.onEditObject(object),
      },
      {
        label: 'Edit object variables',
        click: () => this._editVariables(object),
      },
      { type: 'separator' },
      {
        label: 'Tags',
        submenu: buildTagsMenuTemplate({
          noTagLabel: 'No tags',
          getAllTags: this.props.getAllObjectTags,
          selectedTags: getTagsFromString(object.getTags()),
          onChange: objectTags => {
            this._changeObjectTags(object, objectTags);
          },
          editTagsLabel: 'Add/edit tags...',
          onEditTags: () => this._openEditTagDialog(object),
        }),
      },
      {
        label: 'Rename',
        click: () => this._editName(objectWithContext),
      },
      {
        label: 'Set as a global object',
        click: () => this._setAsGlobalObject(objectWithContext),
      },
      {
        label: 'Delete',
        click: () => this._deleteObject(objectWithContext),
      },
      { type: 'separator' },
      {
        label: 'Add a new object...',
        click: () => this.onAddNewObject(),
      },
      { type: 'separator' },
      {
        label: 'Copy',
        click: () => this._copyObject(objectWithContext),
      },
      {
        label: 'Cut',
        click: () => this._cutObject(objectWithContext),
      },
      {
        label: getPasteLabel(objectWithContext.global),
        enabled: Clipboard.has(CLIPBOARD_KIND),
        click: () => this._paste(objectWithContext),
      },
      {
        label: 'Duplicate',
        click: () => this._duplicateObject(objectWithContext),
      },
    ];
  };

  _onObjectModified = (shouldForceUpdateList: boolean) => {
    if (this.props.unsavedChanges)
      this.props.unsavedChanges.triggerUnsavedChanges();

    if (shouldForceUpdateList) this.forceUpdateList();
    else this.forceUpdate();
  };

  render() {
    const { project, objectsContainer, selectedObjectTags } = this.props;
    const { searchText, tagEditedObject } = this.state;

    const lists = enumerateObjects(project, objectsContainer);
    this._displayedObjectWithContextsList = filterObjectsList(
      lists.allObjectsList,
      {
        searchText,
        selectedTags: selectedObjectTags,
      }
    );
    const selectedObjects = this._displayedObjectWithContextsList.filter(
      objectWithContext =>
        this.props.selectedObjectNames.indexOf(
          objectWithContext.object.getName()
        ) !== -1
    );
    const renamedObjectWithContext = this._displayedObjectWithContextsList.find(
      isSameObjectWithContext(this.state.renamedObjectWithContext)
    );

    // Force List component to be mounted again if project or objectsContainer
    // has been changed. Avoid accessing to invalid objects that could
    // crash the app.
    const listKey = project.ptr + ';' + objectsContainer.ptr;

    return (
      <Background maxWidth>
        <TagChips
          tags={this.props.selectedObjectTags}
          onChange={this.props.onChangeSelectedObjectTags}
        />
        <div style={styles.listContainer}>
          <AutoSizer>
            {({ height, width }) => (
              <SortableVirtualizedItemList
                key={listKey}
                ref={sortableList => (this.sortableList = sortableList)}
                fullList={this._displayedObjectWithContextsList}
                width={width}
                height={height}
                getItemName={getObjectWithContextName}
                getItemThumbnail={this._getObjectThumbnail}
                isItemBold={isObjectWithContextGlobal}
                onEditItem={objectWithContext =>
                  this.props.onEditObject(objectWithContext.object)
                }
                onAddNewItem={this.onAddNewObject}
                addNewItemLabel={<Trans>Add a new object</Trans>}
                selectedItems={selectedObjects}
                onItemSelected={this._selectObject}
                renamedItem={renamedObjectWithContext}
                onRename={this._rename}
                buildMenuTemplate={this._renderObjectMenuTemplate}
                onMoveSelectionToItem={this._moveSelectionTo}
                canMoveSelectionToItem={this._canMoveSelectionTo}
                reactDndType={objectWithContextReactDndType}
              />
            )}
          </AutoSizer>
        </div>
        <SearchBar
          value={searchText}
          onRequestSearch={() => {}}
          onChange={text =>
            this.setState({
              searchText: text,
            })
          }
        />
        {this.state.newObjectDialogOpen && (
          <NewObjectDialog
            open={this.state.newObjectDialogOpen}
            onClose={() =>
              this.setState({
                newObjectDialogOpen: false,
              })
            }
            onChoose={this.addObject}
            project={project}
          />
        )}
        {this.state.variablesEditedObject && (
          <VariablesEditorDialog
            open
            variablesContainer={
              this.state.variablesEditedObject &&
              this.state.variablesEditedObject.getVariables()
            }
            onCancel={() => this._editVariables(null)}
            onApply={() => this._editVariables(null)}
            title={<Trans>Object Variables</Trans>}
            emptyExplanationMessage={
              <Trans>
                When you add variables to an object, any instance of the object
                put on the scene or created during the game will have these
                variables attached to it.
              </Trans>
            }
            emptyExplanationSecondMessage={
              <Trans>
                For example, you can have a variable called Life representing
                the health of the object.
              </Trans>
            }
          />
        )}
        {tagEditedObject && (
          <EditTagsDialog
            tagsString={tagEditedObject.getTags()}
            onEdit={tags => {
              this._changeObjectTags(tagEditedObject, tags);
              this._openEditTagDialog(null);
            }}
            onCancel={() => this._openEditTagDialog(null)}
          />
        )}
      </Background>
    );
  }
}
