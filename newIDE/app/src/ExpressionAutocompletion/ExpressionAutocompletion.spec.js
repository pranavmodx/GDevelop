// @flow
import {
  getAutocompletionsFromDescriptions,
  insertAutocompletionInExpression,
} from '.';
const gd = global.gd;

const makeTestContext = () => {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const testLayout = project.insertNewLayout('Scene', 0);

  testLayout.insertNewObject(project, 'Sprite', 'MySpriteObject', 0);
  const spriteObjectWithBehaviors = testLayout.insertNewObject(
    project,
    'Sprite',
    'MySpriteObjectWithBehaviors',
    0
  );
  spriteObjectWithBehaviors.addNewBehavior(
    project,
    'PlatformBehavior::PlatformerObjectBehavior',
    'PlatformerObject'
  );
  spriteObjectWithBehaviors.addNewBehavior(
    project,
    'DraggableBehavior::Draggable',
    'Draggable'
  );

  const parser = new gd.ExpressionParser2(
    gd.JsPlatform.get(),
    project,
    testLayout
  );

  return {
    project,
    testLayout,
    parser,
  };
};

describe('ExpressionAutocompletion', () => {
  it('can autocomplete objects', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser.parseExpression('number', 'My').get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      1
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toHaveLength(2);
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'MySpriteObjectWithBehaviors',
          addDot: true,
          kind: 'Object',
        }),
        expect.objectContaining({
          completion: 'MySpriteObject',
          addDot: true,
          kind: 'Object',
        }),
      ])
    );

    const expressionNode2 = parser
      .parseExpression('number', 'MySpriteObjectW')
      .get();
    const completionDescriptions2 = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode2,
      1
    );
    const autocompletions2 = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions2
    );
    expect(autocompletions2).toHaveLength(1);
    expect(autocompletions2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'MySpriteObjectWithBehaviors',
          addDot: true,
          kind: 'Object',
        }),
      ])
    );
  });

  it('can autocomplete free expressions', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser.parseExpression('number', 'To').get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      1
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'ToDeg',
          addParenthesis: true,
          isExact: false,
        }),
        expect.objectContaining({
          completion: 'ToRad',
          addParenthesis: true,
          isExact: false,
        }),
        expect.objectContaining({
          completion: 'TouchX',
          addParenthesis: true,
          isExact: false,
        }),
      ])
    );
  });

  it('can autocomplete object expressions', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser
      .parseExpression('number', 'MySpriteObject.Po')
      .get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      16
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'PointX',
          addParenthesis: true,
          isExact: false,
        }),
        expect.objectContaining({
          completion: 'PointY',
          addParenthesis: true,
          isExact: false,
        }),
      ])
    );
  });

  it('can autocomplete behaviors (1)', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser
      .parseExpression('number', 'MySpriteObjectWithBehaviors.Plat')
      .get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      28
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'PlatformerObject',
          addNamespaceSeparator: true,
          isExact: false,
        }),
      ])
    );
  });

  it('can autocomplete behaviors (2)', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser
      .parseExpression('number', 'MySpriteObjectWithBehaviors.a')
      .get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      28
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'PlatformerObject',
          addNamespaceSeparator: true,
          isExact: false,
        }),
        expect.objectContaining({
          completion: 'PlatformerObject',
          addNamespaceSeparator: true,
          isExact: false,
        }),
      ])
    );
  });

  it('can autocomplete behavior expressions', () => {
    const { project, testLayout, parser } = makeTestContext();
    const scope = { layout: testLayout };

    const expressionNode = parser
      .parseExpression(
        'number',
        'MySpriteObjectWithBehaviors.PlatformerObject::Jum'
      )
      .get();
    const completionDescriptions = gd.ExpressionCompletionFinder.getCompletionDescriptionsFor(
      expressionNode,
      47
    );
    const autocompletions = getAutocompletionsFromDescriptions(
      {
        gd,
        globalObjectsContainer: project,
        objectsContainer: testLayout,
        scope,
      },
      completionDescriptions
    );
    expect(autocompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completion: 'JumpSpeed',
          addParenthesis: true,
          isExact: false,
        }),
      ])
    );
  });

  it('can insert autocompletion', () => {
    // Check empty string/over limit.
    expect(
      insertAutocompletionInExpression(
        { expression: '', caretLocation: 0 },
        { completion: 'HelloWorld' }
      )
    ).toMatchObject({ expression: 'HelloWorld' });
    expect(
      insertAutocompletionInExpression(
        { expression: '', caretLocation: 1 },
        { completion: 'HelloWorld' }
      )
    ).toMatchObject({ expression: 'HelloWorld' });

    // Check inserting suffixes.
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello', caretLocation: 7 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addDot: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld.' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addNamespaceSeparator: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld::' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addParenthesis: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld(' });

    // Check already existing suffixes.
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addDot: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld.' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello::', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addNamespaceSeparator: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld::' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello(', caretLocation: 7 },
        {
          completion: 'HelloWorld',
          addParenthesis: true,
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld(' });

    // Check word limits.
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 7 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld + 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 8 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld + 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 9 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld + 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 10 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld + 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 11 },
        {
          completion: 'HelloWorld',
        }
      )
    ).toMatchObject({ expression: '123 + HelloWorld + 456' });

    // Check word limits with separators.
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello + 456', caretLocation: 12 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello World+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello +456', caretLocation: 12 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello World+456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello ++456', caretLocation: 12 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello World++456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello ++456', caretLocation: 11 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + World ++456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.+ 456', caretLocation: 12 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a+ 456', caretLocation: 12 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a+ 456', caretLocation: 13 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a:+ 456', caretLocation: 13 },
        {
          completion: 'World',
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World:+ 456' });

    // Check word limits with separators and suffixes.
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a:+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addNamespaceSeparator: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World:+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a:+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addDot: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World.:+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a:+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addParenthesis: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World(:+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a.+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addNamespaceSeparator: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World::.+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a.+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addDot: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World.+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a.+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addParenthesis: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World(.+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a(+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addNamespaceSeparator: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World::(+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a(+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addDot: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World.(+ 456' });
    expect(
      insertAutocompletionInExpression(
        { expression: '123 + Hello.a(+ 456', caretLocation: 13 },
        {
          completion: 'World',
          addParenthesis: true,
        }
      )
    ).toMatchObject({ expression: '123 + Hello.World(+ 456' });
  });
});
