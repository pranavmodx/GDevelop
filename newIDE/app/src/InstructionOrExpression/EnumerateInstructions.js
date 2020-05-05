// @flow
import {
  type EnumeratedInstructionOrExpressionMetadata,
  type InstructionOrExpressionScope,
} from './EnumeratedInstructionOrExpressionMetadata.js';
const gd = global.gd;

const GROUP_DELIMITER = '/';

type ExtensionsExtraInstructions = {
  BuiltinObject?: {
    '': Array<string>,
  },
  Physics2?: {
    'Physics2::Physics2Behavior': Array<string>,
  },
};

const freeActionsToAddToObject: ExtensionsExtraInstructions = {
  BuiltinObject: {
    '': ['AjoutHasard', 'Create', 'AjoutObjConcern'],
  },
};

const freeConditionsToAddToObject: ExtensionsExtraInstructions = {
  BuiltinObject: {
    '': [
      'AjoutHasard',
      'AjoutObjConcern',
      'CollisionNP',
      'NbObjet',
      'PickNearest',
      'Distance',
      'SeDirige',
      'EstTourne',
      'SourisSurObjet',
    ],
  },
};

const freeActionsToAddToBehavior: ExtensionsExtraInstructions = {};

const freeConditionsToAddToBehavior: ExtensionsExtraInstructions = {
  Physics2: {
    'Physics2::Physics2Behavior': ['Physics2::Collision'],
  },
};

const freeInstructionsToRemove = {
  BuiltinObject: [
    // $FlowFixMe
    ...freeActionsToAddToObject.BuiltinObject[''],
    // $FlowFixMe
    ...freeConditionsToAddToObject.BuiltinObject[''],
  ],
  Physics2: [
    // $FlowFixMe
    ...freeConditionsToAddToBehavior.Physics2['Physics2::Physics2Behavior'],
  ],
};

const filterInstructionsToRemove = (
  list: Array<EnumeratedInstructionOrExpressionMetadata>,
  typesToRemove: ?$ReadOnlyArray<string>
) => {
  const types = typesToRemove; // Make Flow happy
  if (!types) return list;

  return list.filter(metadata => types.indexOf(metadata.type) === -1);
};

const enumerateExtraBehaviorInstructions = (
  isCondition: boolean,
  extension: gdPlatformExtension,
  behaviorType: string,
  prefix: string,
  scope: InstructionOrExpressionScope
) => {
  const extensionName = extension.getName();

  const extensionsExtraInstructions = isCondition
    ? freeConditionsToAddToBehavior[extensionName]
    : freeActionsToAddToBehavior[extensionName];
  if (!extensionsExtraInstructions) {
    return [];
  }

  const objectExtraInstructions = extensionsExtraInstructions[behaviorType];
  if (!objectExtraInstructions) {
    return [];
  }

  const instructionMetadataMap = isCondition
    ? extension.getAllConditions()
    : extension.getAllActions();

  return objectExtraInstructions.map(type =>
    enumerateInstruction(prefix, type, instructionMetadataMap.get(type), scope)
  );
};

const enumerateExtraObjectInstructions = (
  isCondition: boolean,
  extension: gdPlatformExtension,
  objectType: string,
  prefix: string,
  scope: InstructionOrExpressionScope
) => {
  const extensionName = extension.getName();

  const extensionsExtraInstructions = isCondition
    ? freeConditionsToAddToObject[extensionName]
    : freeActionsToAddToObject[extensionName];
  if (!extensionsExtraInstructions) {
    return [];
  }

  const objectExtraInstructions = extensionsExtraInstructions[objectType];
  if (!objectExtraInstructions) {
    return [];
  }

  const instructionMetadataMap = isCondition
    ? extension.getAllConditions()
    : extension.getAllActions();

  return objectExtraInstructions.map(type =>
    enumerateInstruction(prefix, type, instructionMetadataMap.get(type), scope)
  );
};

const enumerateInstruction = (
  prefix: string,
  type: string,
  instrMetadata: gdInstructionMetadata,
  scope: InstructionOrExpressionScope
): EnumeratedInstructionOrExpressionMetadata => {
  const displayedName = instrMetadata.getFullName();
  const groupName = instrMetadata.getGroup();
  const iconFilename = instrMetadata.getIconFilename();
  const fullGroupName = prefix + groupName;

  return {
    type,
    metadata: instrMetadata,
    iconFilename,
    displayedName,
    fullGroupName,
    scope,
    isPrivate: instrMetadata.isPrivate(),
  };
};

const enumerateExtensionInstructions = (
  prefix: string,
  instructions: gdMapStringInstructionMetadata,
  scope: InstructionOrExpressionScope
): Array<EnumeratedInstructionOrExpressionMetadata> => {
  //Get the map containing the metadata of the instructions provided by the extension...
  const instructionsTypes = instructions.keys();
  const allInstructions = [];

  //... and add each instruction
  for (let j = 0; j < instructionsTypes.size(); ++j) {
    const type = instructionsTypes.get(j);
    const instrMetadata = instructions.get(type);
    if (instrMetadata.isHidden()) continue;

    allInstructions.push(
      enumerateInstruction(prefix, type, instrMetadata, scope)
    );
  }

  return allInstructions;
};

/**
 * List all the instructions available.
 */
export const enumerateAllInstructions = (
  isCondition: boolean
): Array<EnumeratedInstructionOrExpressionMetadata> => {
  let allInstructions = [];

  const allExtensions = gd
    .asPlatform(gd.JsPlatform.get())
    .getAllPlatformExtensions();
  for (let i = 0; i < allExtensions.size(); ++i) {
    const extension = allExtensions.get(i);
    const extensionName = extension.getName();
    const allObjectsTypes = extension.getExtensionObjectsTypes();
    const allBehaviorsTypes = extension.getBehaviorsTypes();

    let prefix = '';
    if (allObjectsTypes.size() > 0 || allBehaviorsTypes.size() > 0) {
      prefix =
        extensionName === 'BuiltinObject'
          ? 'Common ' +
            (isCondition ? 'conditions' : 'actions') +
            ' for all objects'
          : extension.getFullName();
      prefix += GROUP_DELIMITER;
    }

    //Free instructions
    const extensionFreeInstructions = enumerateExtensionInstructions(
      prefix,
      isCondition ? extension.getAllConditions() : extension.getAllActions(),
      {
        objectMetadata: undefined,
        behaviorMetadata: undefined,
      }
    );
    allInstructions = [
      ...allInstructions,
      ...filterInstructionsToRemove(
        extensionFreeInstructions,
        freeInstructionsToRemove[extensionName]
      ),
    ];

    //Objects instructions:
    for (let j = 0; j < allObjectsTypes.size(); ++j) {
      const objectType = allObjectsTypes.get(j);
      const objectMetadata = extension.getObjectMetadata(objectType);
      const scope = { objectMetadata };
      allInstructions = [
        ...allInstructions,
        ...enumerateExtensionInstructions(
          prefix,
          isCondition
            ? extension.getAllConditionsForObject(objectType)
            : extension.getAllActionsForObject(objectType),
          scope
        ),
        ...enumerateExtraObjectInstructions(
          isCondition,
          extension,
          objectType,
          prefix,
          scope
        ),
      ];
    }

    //Behaviors instructions:
    for (let j = 0; j < allBehaviorsTypes.size(); ++j) {
      const behaviorType = allBehaviorsTypes.get(j);
      const behaviorMetadata = extension.getBehaviorMetadata(behaviorType);
      const scope = { behaviorMetadata };

      allInstructions = [
        ...allInstructions,
        ...enumerateExtensionInstructions(
          prefix,
          isCondition
            ? extension.getAllConditionsForBehavior(behaviorType)
            : extension.getAllActionsForBehavior(behaviorType),
          scope
        ),
        ...enumerateExtraBehaviorInstructions(
          isCondition,
          extension,
          behaviorType,
          prefix,
          scope
        ),
      ];
    }
  }

  return allInstructions;
};

const orderFirstInstructionsWithoutGroup = (
  allInstructions: Array<EnumeratedInstructionOrExpressionMetadata>
) => {
  const noGroupInstructions = allInstructions.filter(
    instructionMetadata => instructionMetadata.fullGroupName.length === 0
  );
  const instructionsWithGroups = allInstructions.filter(
    instructionMetadata => instructionMetadata.fullGroupName.length !== 0
  );

  return [...noGroupInstructions, ...instructionsWithGroups];
};

/**
 * List all the instructions that can be used for the given object,
 * in the given context. This includes instructions for the behaviors
 * attached to the object.
 */
export const enumerateObjectAndBehaviorsInstructions = (
  isCondition: boolean,
  globalObjectsContainer: gdObjectsContainer,
  objectsContainer: gdObjectsContainer,
  objectName: string
): Array<EnumeratedInstructionOrExpressionMetadata> => {
  let allInstructions = [];

  const objectType: string = gd.getTypeOfObject(
    globalObjectsContainer,
    objectsContainer,
    objectName,
    true
  );
  const objectBehaviorNames: Array<string> = gd
    .getBehaviorsOfObject(
      globalObjectsContainer,
      objectsContainer,
      objectName,
      true
    )
    .toJSArray();
  const objectBehaviorTypes = new Set(
    objectBehaviorNames.map(behaviorName =>
      gd.getTypeOfBehavior(
        globalObjectsContainer,
        objectsContainer,
        behaviorName
      )
    )
  );
  const baseObjectType = ''; /* An empty string means the base object */

  const allExtensions = gd
    .asPlatform(gd.JsPlatform.get())
    .getAllPlatformExtensions();
  for (let i = 0; i < allExtensions.size(); ++i) {
    const extension = allExtensions.get(i);
    const hasObjectType =
      extension
        .getExtensionObjectsTypes()
        .toJSArray()
        .indexOf(objectType) !== -1;
    const hasBaseObjectType =
      extension
        .getExtensionObjectsTypes()
        .toJSArray()
        .indexOf(baseObjectType) !== -1;
    const behaviorTypes = extension
      .getBehaviorsTypes()
      .toJSArray()
      .filter(behaviorType => objectBehaviorTypes.has(behaviorType));

    if (!hasObjectType && !hasBaseObjectType && behaviorTypes.length === 0) {
      continue;
    }

    const prefix = '';

    //Objects instructions:
    if (objectType !== baseObjectType && hasObjectType) {
      const objectMetadata = extension.getObjectMetadata(objectType);
      const scope = { objectMetadata };

      allInstructions = [
        ...allInstructions,
        ...enumerateExtensionInstructions(
          prefix,
          isCondition
            ? extension.getAllConditionsForObject(objectType)
            : extension.getAllActionsForObject(objectType),
          scope
        ),
        ...enumerateExtraObjectInstructions(
          isCondition,
          extension,
          baseObjectType,
          prefix,
          scope
        ),
      ];
    }

    if (hasBaseObjectType) {
      const objectMetadata = extension.getObjectMetadata(baseObjectType);
      const scope = { objectMetadata };

      allInstructions = [
        ...allInstructions,
        ...enumerateExtensionInstructions(
          prefix,
          isCondition
            ? extension.getAllConditionsForObject(baseObjectType)
            : extension.getAllActionsForObject(baseObjectType),
          scope
        ),
        ...enumerateExtraObjectInstructions(
          isCondition,
          extension,
          baseObjectType,
          prefix,
          scope
        ),
      ];
    }

    //Behaviors instructions (show them at the top of the list):
    // eslint-disable-next-line
    behaviorTypes.forEach(behaviorType => {
      const behaviorMetadata = extension.getBehaviorMetadata(behaviorType);
      const scope = { behaviorMetadata };

      allInstructions = [
        ...enumerateExtensionInstructions(
          prefix,
          isCondition
            ? extension.getAllConditionsForBehavior(behaviorType)
            : extension.getAllActionsForBehavior(behaviorType),
          scope
        ),
        ...enumerateExtraBehaviorInstructions(
          isCondition,
          extension,
          behaviorType,
          prefix,
          scope
        ),
        ...allInstructions,
      ];
    });
  }

  return orderFirstInstructionsWithoutGroup(allInstructions);
};

/**
 * Enumerate all the instructions that are not directly tied
 * to an object.
 */
export const enumerateFreeInstructions = (
  isCondition: boolean
): Array<EnumeratedInstructionOrExpressionMetadata> => {
  let allFreeInstructions = [];

  const allExtensions = gd
    .asPlatform(gd.JsPlatform.get())
    .getAllPlatformExtensions();
  for (let i = 0; i < allExtensions.size(); ++i) {
    const extension = allExtensions.get(i);
    const extensionName: string = extension.getName();
    const allObjectsTypes = extension.getExtensionObjectsTypes();
    const allBehaviorsTypes = extension.getBehaviorsTypes();

    let prefix = '';
    if (allObjectsTypes.size() > 0 || allBehaviorsTypes.size() > 0) {
      prefix = extensionName === 'BuiltinObject' ? '' : extension.getFullName();
      prefix += GROUP_DELIMITER;
    }

    //Free instructions
    const extensionFreeInstructions = enumerateExtensionInstructions(
      prefix,
      isCondition ? extension.getAllConditions() : extension.getAllActions(),
      {
        objectMetadata: undefined,
        behaviorMetadata: undefined,
      }
    );
    allFreeInstructions = [
      ...allFreeInstructions,
      ...filterInstructionsToRemove(
        extensionFreeInstructions,
        freeInstructionsToRemove[extensionName]
      ),
    ];
  }

  return allFreeInstructions;
};

export type InstructionFilteringOptions = {|
  searchText: string,
|};

export const filterInstructionsList = (
  list: Array<EnumeratedInstructionOrExpressionMetadata>,
  { searchText }: InstructionFilteringOptions
): Array<EnumeratedInstructionOrExpressionMetadata> => {
  if (!searchText === '') {
    return list;
  }

  const lowercaseSearch = searchText.toLowerCase();

  const matchCritera = (
    enumeratedInstructionOrExpressionMetadata: EnumeratedInstructionOrExpressionMetadata
  ) => {
    const {
      displayedName,
      fullGroupName,
    } = enumeratedInstructionOrExpressionMetadata;
    return (
      displayedName.toLowerCase().indexOf(lowercaseSearch) !== -1 ||
      fullGroupName.toLowerCase().indexOf(lowercaseSearch) !== -1
    );
  };

  const favorExactMatch = (
    list: Array<EnumeratedInstructionOrExpressionMetadata>
  ): Array<EnumeratedInstructionOrExpressionMetadata> => {
    if (!searchText) {
      return list;
    }

    for (var i = 0; i < list.length; ++i) {
      if (list[i].displayedName.toLowerCase() === lowercaseSearch) {
        const exactMatch = list[i];
        list.splice(i, 1);
        list.unshift(exactMatch);
      }
    }

    return list;
  };

  // See EnumerateExpressions for a similar logic for expressions
  return favorExactMatch(list.filter(matchCritera));
};

export const getObjectParameterIndex = (
  instructionMetadata: gdInstructionMetadata
) => {
  const parametersCount = instructionMetadata.getParametersCount();
  if (parametersCount >= 1) {
    const firstParameterType = instructionMetadata.getParameter(0).getType();
    if (firstParameterType === 'object') {
      // By convention, all object conditions/actions have the object as first parameter
      return 0;
    }
    if (gd.ParameterMetadata.isObject(firstParameterType)) {
      // Some "free condition/actions" might be considered as "object" instructions, in which
      // case they are taking an object list as fist parameter - which will be identified
      // by gd.ParameterMetadata.isObject
      return 0;
    }

    if (
      firstParameterType === 'objectsContext' ||
      firstParameterType === 'currentScene'
    ) {
      if (parametersCount >= 2) {
        const secondParameterType = instructionMetadata
          .getParameter(1)
          .getType();
        if (gd.ParameterMetadata.isObject(secondParameterType)) {
          // Some special action/conditions like "Create", "AjoutHasard" (pick random object) or
          // "AjoutObjConcern" (pick all objects) are "free condition/actions", but are manipulating
          // objects list, so their first parameter is an "objectsContext" or "currentScene",
          // followed by an object parameter.
          return 1;
        }
      }
    }
  }

  return -1;
};
