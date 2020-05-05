// @flow
import * as React from 'react';
import MainFrame from './MainFrame';
import Window from './Utils/Window';
import ExportDialog from './Export/ExportDialog';
import CreateProjectDialog from './ProjectCreation/CreateProjectDialog';
import Authentification from './Utils/GDevelopServices/Authentification';
import './UI/iconmoon-font.css'; // Styles for Iconmoon font.

// Import for browser only IDE
import BrowserExamples from './ProjectCreation/BrowserExamples';
import BrowserStarters from './ProjectCreation/BrowserStarters';
import BrowserIntroDialog from './MainFrame/BrowserIntroDialog';
import browserResourceSources from './ResourcesList/BrowserResourceSources';
import browserResourceExternalEditors from './ResourcesList/BrowserResourceExternalEditors';
import BrowserS3PreviewLauncher from './Export/BrowserExporters/BrowserS3PreviewLauncher';
import { getBrowserExporters } from './Export/BrowserExporters';
import makeExtensionsLoader from './JsExtensionsLoader/BrowserJsExtensionsLoader';
import ObjectsEditorService from './ObjectEditor/ObjectsEditorService';
import ObjectsRenderingService from './ObjectsRendering/ObjectsRenderingService';
import { makeBrowserS3EventsFunctionCodeWriter } from './EventsFunctionsExtensionsLoader/CodeWriters/BrowserS3EventsFunctionCodeWriter';
import Providers from './MainFrame/Providers';
import ProjectStorageProviders from './ProjectsStorage/ProjectStorageProviders';
import InternalFileStorageProvider from './ProjectsStorage/InternalFileStorageProvider';
import GoogleDriveStorageProvider from './ProjectsStorage/GoogleDriveStorageProvider';
import DownloadFileStorageProvider from './ProjectsStorage/DownloadFileStorageProvider';
import DropboxStorageProvider from './ProjectsStorage/DropboxStorageProvider';
import OneDriveStorageProvider from './ProjectsStorage/OneDriveStorageProvider';
import UnsavedChangesContext from './MainFrame/UnsavedChangesContext';

export const create = (authentification: Authentification) => {
  Window.setUpContextMenu();

  let app = null;
  const appArguments = Window.getArguments();

  app = (
    <Providers
      authentification={authentification}
      disableCheckForUpdates={!!appArguments['disable-update-check']}
      eventsFunctionCodeWriter={makeBrowserS3EventsFunctionCodeWriter()}
      eventsFunctionsExtensionWriter={null}
      eventsFunctionsExtensionOpener={null}
    >
      {({ i18n, eventsFunctionsExtensionsState }) => (
        <ProjectStorageProviders
          appArguments={appArguments}
          storageProviders={[
            InternalFileStorageProvider,
            GoogleDriveStorageProvider,
            DropboxStorageProvider,
            OneDriveStorageProvider,
            DownloadFileStorageProvider,
          ]}
          defaultStorageProvider={InternalFileStorageProvider}
        >
          {({
            currentStorageProviderOperations,
            useStorageProvider,
            storageProviders,
            initialFileMetadataToOpen,
          }) => (
            <UnsavedChangesContext.Consumer>
              {unsavedChanges => (
                <MainFrame
                  i18n={i18n}
                  eventsFunctionsExtensionsState={
                    eventsFunctionsExtensionsState
                  }
                  renderPreviewLauncher={(props, ref) => (
                    <BrowserS3PreviewLauncher {...props} ref={ref} />
                  )}
                  renderExportDialog={props => (
                    <ExportDialog
                      {...props}
                      exporters={getBrowserExporters()}
                      allExportersRequireOnline
                    />
                  )}
                  renderCreateDialog={props => (
                    <CreateProjectDialog
                      {...props}
                      examplesComponent={BrowserExamples}
                      startersComponent={BrowserStarters}
                    />
                  )}
                  introDialog={<BrowserIntroDialog />}
                  storageProviders={storageProviders}
                  useStorageProvider={useStorageProvider}
                  storageProviderOperations={currentStorageProviderOperations}
                  resourceSources={browserResourceSources}
                  resourceExternalEditors={browserResourceExternalEditors}
                  extensionsLoader={makeExtensionsLoader({
                    objectsEditorService: ObjectsEditorService,
                    objectsRenderingService: ObjectsRenderingService,
                    filterExamples: !Window.isDev(),
                  })}
                  initialFileMetadataToOpen={initialFileMetadataToOpen}
                  unsavedChanges={unsavedChanges}
                />
              )}
            </UnsavedChangesContext.Consumer>
          )}
        </ProjectStorageProviders>
      )}
    </Providers>
  );

  return app;
};
