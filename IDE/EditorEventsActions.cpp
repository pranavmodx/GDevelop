#include "OldEventsEditor.h"
#include "ChoixAction.h"
#include "Clipboard.h"

/**
 * Edit an action
 */
void OldEventsEditor::OnEditActionMenuSelected(wxCommandEvent& event)
{
    if ( !instructionsSelected ) return;

    Instruction & instr = GetLastSelectedInstruction();

    ChoixAction dialog(this, game, scene);
    dialog.Type = instr.GetType();
    dialog.Param = instr.GetParameters();
    dialog.Loc = instr.IsLocal();
    dialog.RefreshFromAction();
    dialog.Fit();

    if ( dialog.ShowModal() == 0)
    {
        instr.SetType( dialog.Type );
        instr.SetParameters( dialog.Param );
        instr.SetLocal( dialog.Loc );

        GetLastSelectedEvent()->eventHeightNeedUpdate = true;
        ChangesMadeOnEvents();
    }
}

void OldEventsEditor::OnAddActionMenuSelected(wxCommandEvent& event)
{
    if ( !instructionsSelected ) return;

    ChoixAction dialog(this, game, scene);
    if ( dialog.ShowModal() == 0)
    {
        Instruction instruction;
        instruction.SetType(dialog.Type);
        instruction.SetParameters(dialog.Param);
        instruction.SetLocal(dialog.Loc);

        GetLastSelectedListOfInstructions()->push_back(instruction);

        GetLastSelectedEvent()->eventHeightNeedUpdate = true;
        ChangesMadeOnEvents();
    }
}

void OldEventsEditor::OnDelActionMenuSelected(wxCommandEvent& event)
{
    if ( !instructionsSelected || boost::tuples::get<3>(eventsSelected[0]) >= GetLastSelectedListOfInstructions()->size() ) return;

    GetLastSelectedListOfInstructions()->erase( GetLastSelectedListOfInstructions()->begin() + boost::tuples::get<3>(eventsSelected[0]) );

        GetLastSelectedEvent()->eventHeightNeedUpdate = true;
    ChangesMadeOnEvents();
}

void OldEventsEditor::OnCopyActionMenuSelected(wxCommandEvent& event)
{
    if (!instructionsSelected ||
        boost::tuples::get<3>(eventsSelected[0]) >= GetLastSelectedListOfInstructions()->size() ||
        conditionsSelected ) return;

    Clipboard * clipboard = Clipboard::GetInstance();
    clipboard->SetAction(GetLastSelectedInstruction());
}

void OldEventsEditor::OnCutActionMenuSelected(wxCommandEvent& event)
{
    if (!instructionsSelected ||
        boost::tuples::get<3>(eventsSelected[0]) >= GetLastSelectedListOfInstructions()->size() ||
        conditionsSelected ) return;

    Clipboard * clipboard = Clipboard::GetInstance();
    clipboard->SetAction(GetLastSelectedInstruction());

    GetLastSelectedListOfInstructions()->erase( GetLastSelectedListOfInstructions()->begin() + boost::tuples::get<3>(eventsSelected[0]) );

    GetLastSelectedEvent()->eventHeightNeedUpdate = true;
    ChangesMadeOnEvents();
}

void OldEventsEditor::OnPasteActionMenuSelected(wxCommandEvent& event)
{
    if ( !instructionsSelected || conditionsSelected) return;

    Clipboard * clipboard = Clipboard::GetInstance();
    if ( !clipboard->HasAction() ) return;

    if ( boost::tuples::get<3>(eventsSelected[0]) >= GetLastSelectedListOfInstructions()->size() )
        GetLastSelectedListOfInstructions()->push_back(clipboard->GetAction());
    else
        GetLastSelectedListOfInstructions()->insert(GetLastSelectedListOfInstructions()->begin()+boost::tuples::get<3>(eventsSelected[0]), clipboard->GetAction());

    GetLastSelectedEvent()->eventHeightNeedUpdate = true;
    ChangesMadeOnEvents();
}
