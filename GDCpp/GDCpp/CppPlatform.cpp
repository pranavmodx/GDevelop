/** \file
 *  Game Develop
 *  2008-2014 Florian Rival (Florian.Rival@gmail.com)
 */

#include "GDCpp/CppPlatform.h"
#include "GDCore/PlatformDefinition/Platform.h"
#include "GDCore/PlatformDefinition/Project.h"
#include "GDCore/Tools/Localization.h"
#include "GDCpp/IDE/Exporter.h"
#include "GDCpp/Project.h"
#include "GDCpp/ExtensionBase.h"
#include "GDCpp/SoundManager.h"
#include "GDCpp/Automatism.h"
#include "GDCpp/FontManager.h"
#include "GDCpp/IDE/CodeCompiler.h"
#include "GDCpp/IDE/ChangesNotifier.h"
#include "GDCpp/IDE/Dialogs/CppLayoutPreviewer.h"

//Builtin extensions
#include "GDCpp/BuiltinExtensions/BaseObjectExtension.h"
#include "GDCpp/BuiltinExtensions/CommonInstructionsExtension.h"
#include "GDCpp/BuiltinExtensions/CommonConversionsExtension.h"
#include "GDCpp/BuiltinExtensions/SceneExtension.h"
#include "GDCpp/BuiltinExtensions/StringInstructionsExtension.h"
#include "GDCpp/BuiltinExtensions/MouseExtension.h"
#include "GDCpp/BuiltinExtensions/TimeExtension.h"
#include "GDCpp/BuiltinExtensions/VariablesExtension.h"
#include "GDCpp/BuiltinExtensions/SpriteExtension.h"
#include "GDCpp/BuiltinExtensions/MathematicalToolsExtension.h"
#include "GDCpp/BuiltinExtensions/AdvancedExtension.h"
#include "GDCpp/BuiltinExtensions/KeyboardExtension.h"
#include "GDCpp/BuiltinExtensions/AudioExtension.h"
#include "GDCpp/BuiltinExtensions/CameraExtension.h"
#include "GDCpp/BuiltinExtensions/JoystickExtension.h"
#include "GDCpp/BuiltinExtensions/FileExtension.h"
#include "GDCpp/BuiltinExtensions/NetworkExtension.h"
#include "GDCpp/BuiltinExtensions/WindowExtension.h"
#include "GDCpp/BuiltinExtensions/ExternalLayoutsExtension.h"
#include "GDCpp/RuntimeObject.h"
#include "GDCpp/Object.h"
#include "GDCpp/CommonTools.h"

#if defined(GD_IDE_ONLY) && !defined(GD_NO_WX_GUI)
#include <wx/config.h>
#include <wx/filename.h>
#endif

CppPlatform *CppPlatform::singleton = NULL;

#if defined(GD_IDE_ONLY)
ChangesNotifier CppPlatform::changesNotifier;
#endif

CppPlatform::CppPlatform() :
    gd::Platform()
{
#if defined(GD_IDE_ONLY) && !defined(GD_NO_WX_GUI)
    //Events compiler setup
    cout << "* Setting up events compiler..." << endl;
    CodeCompiler::GetInstance()->SetBaseDirectory(ToString(wxGetCwd()));
    wxString eventsCompilerTempDir;
    if ( wxConfigBase::Get()->Read("/Dossier/EventsCompilerTempDir", &eventsCompilerTempDir) && !eventsCompilerTempDir.empty() )
        CodeCompiler::GetInstance()->SetOutputDirectory(ToString(eventsCompilerTempDir));
    else
        CodeCompiler::GetInstance()->SetOutputDirectory(ToString(wxFileName::GetTempDir()+"/GDTemporaries"));
    int eventsCompilerMaxThread = 0;
    if ( wxConfigBase::Get()->Read("/CodeCompiler/MaxThread", &eventsCompilerMaxThread, 0) && eventsCompilerMaxThread >= 0 )
        CodeCompiler::GetInstance()->AllowMultithread(eventsCompilerMaxThread > 1, eventsCompilerMaxThread);
    else
        CodeCompiler::GetInstance()->AllowMultithread(false);

    cout << "* Loading events code compiler configuration" << endl;
    bool deleteTemporaries;
    if ( wxConfigBase::Get()->Read( _T( "/Dossier/EventsCompilerDeleteTemp" ), &deleteTemporaries, true) )
        CodeCompiler::GetInstance()->SetMustDeleteTemporaries(deleteTemporaries);
#endif

    AddExtension(boost::shared_ptr<ExtensionBase>(new BaseObjectExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new SpriteExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new CommonInstructionsExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new CommonConversionsExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new VariablesExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new MouseExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new KeyboardExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new JoystickExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new SceneExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new TimeExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new MathematicalToolsExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new CameraExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new AudioExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new FileExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new NetworkExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new WindowExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new StringInstructionsExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new AdvancedExtension()));
    AddExtension(boost::shared_ptr<ExtensionBase>(new ExternalLayoutsExtension()));
}

bool CppPlatform::AddExtension(boost::shared_ptr<gd::PlatformExtension> platformExtension)
{
    boost::shared_ptr<ExtensionBase> extension = boost::dynamic_pointer_cast<ExtensionBase>(platformExtension);
    if (extension == boost::shared_ptr<ExtensionBase>())
    {
        std::cout << "ERROR: Tried to add an incompatible extension to C++ Platform" << std::endl;
        return false;
    }

    //First add normally the extension
    if (!gd::Platform::AddExtension(extension)) return false;

    //Then Load all runtime objects provided by the extension
    vector < string > objectsTypes = extension->GetExtensionObjectsTypes();
    for ( unsigned int i = 0; i < objectsTypes.size();++i)
    {
        runtimeObjCreationFunctionTable[objectsTypes[i]] = extension->GetRuntimeObjectCreationFunctionPtr(objectsTypes[i]);
        runtimeObjDestroyFunctionTable[objectsTypes[i]] = extension->GetDestroyRuntimeObjectFunction(objectsTypes[i]);
    }

    #if defined(GD_IDE_ONLY) && !defined(GD_NO_WX_GUI)
    //And Add include directories
    for (unsigned int i = 0;i<extension->GetSupplementaryIncludeDirectories().size();++i)
        CodeCompiler::GetInstance()->AddHeaderDirectory(extension->GetSupplementaryIncludeDirectories()[i]);
    #endif
    return true;
}

boost::shared_ptr<RuntimeObject> CppPlatform::CreateRuntimeObject(RuntimeScene & scene, gd::Object & object)
{
    const std::string & type = object.GetType();

    if ( runtimeObjCreationFunctionTable.find(type) == runtimeObjCreationFunctionTable.end() )
    {
        std::cout << "Tried to create an object with an unknown type: " << type << std::endl;
        return boost::shared_ptr<RuntimeObject> ();
    }

    //Create a new object with the type we want.
    RuntimeObject * newObject = runtimeObjCreationFunctionTable[type](scene, object);
    return boost::shared_ptr<RuntimeObject> (newObject, runtimeObjDestroyFunctionTable[type]);
}

#if defined(GD_IDE_ONLY)
std::string CppPlatform::GetDescription() const
{
    return ToString(_("Allows to create 2D games which can be compiled and played on Windows or Linux."));
}

#if !defined(GD_NO_WX_GUI)
boost::shared_ptr<gd::LayoutEditorPreviewer> CppPlatform::GetLayoutPreviewer(gd::LayoutEditorCanvas & editor) const
{
    return boost::shared_ptr<gd::LayoutEditorPreviewer>(new CppLayoutPreviewer(editor));
}
#endif

boost::shared_ptr<gd::ProjectExporter> CppPlatform::GetProjectExporter() const
{
    return boost::shared_ptr<gd::ProjectExporter>(new Exporter);
}

void CppPlatform::OnIDEClosed()
{
#if !defined(GD_NO_WX_GUI)
    if ( CodeCompiler::GetInstance()->MustDeleteTemporaries() )
        CodeCompiler::GetInstance()->ClearOutputDirectory();
#endif

    SoundManager::GetInstance()->DestroySingleton();
    FontManager::GetInstance()->DestroySingleton();
}
#endif

CppPlatform & CppPlatform::Get()
{
    if ( !singleton ) singleton = new CppPlatform;

    return *singleton;
}

void CppPlatform::DestroySingleton()
{
    if ( singleton )
    {
        delete singleton;
        singleton = NULL;
    }
}

#if !defined(GD_IDE_ONLY)
#include "GDCore/PlatformDefinition/Platform.cpp"
#endif

#if !defined(EMSCRIPTEN)
/**
 * Used by Game Develop to create the platform class
 */
extern "C" gd::Platform * GD_API CreateGDPlatform() {
    return &CppPlatform::Get();
}

/**
 * Used by Game Develop to destroy the platform class
 */
extern "C" void GD_API DestroyGDPlatform() {
    CppPlatform::DestroySingleton();
}
#endif