/** \file
 *  Game Develop
 *  2008-2011 Florian Rival (Florian.Rival@gmail.com)
 */

#if defined(GD_IDE_ONLY)

#include "GDL/EventsEditorSelection.h"
#include "GDL/EventsEditorItemsAreas.h"
#include "GDL/Event.h"
#include <iostream>
#include <map>
#include <list>

void EventsEditorSelection::ClearSelection(bool refresh)
{
    eventsSelected.clear();
    instructionsSelected.clear();

    if ( refresh ) eventsEditorCallback.Refresh();
}

void EventsEditorSelection::AddEvent(const EventItem & eventSelection)
{
    if ( eventSelection.event == boost::shared_ptr<BaseEvent>() || eventSelection.eventsList == NULL )
    {
        std::cout << "WARNING, attempted to add a bad event to selection";
        return;
    }

    if ( !EventSelected(eventSelection))
    {
        eventsSelected.insert(eventSelection);
        eventsEditorCallback.Refresh();
    }
}

/**
 * True if an event is selected
 */
bool EventsEditorSelection::EventSelected(const EventItem & event)
{
    return eventsSelected.find(event) != eventsSelected.end();
}

void EventsEditorSelection::AddInstruction(const InstructionItem & instr)
{
    if ( instr.instruction == NULL || instr.instructionList == NULL )
    {
        std::cout << "WARNING, attempted to add a bad instruction to selection";
        return;
    }

    if ( !InstructionSelected(instr))
    {
        instructionsSelected.insert(instr);
        eventsEditorCallback.Refresh();
    }
}
/**
 * Return a vector with all selected events
 */
std::vector < EventItem > EventsEditorSelection::GetAllSelectedEvents()
{
    std::vector < EventItem > results;
    for (boost::unordered_set< EventItem >::iterator it = eventsSelected.begin();it!=eventsSelected.end();++it)
        results.push_back(*it);

    return results;
}

std::vector < EventItem > EventsEditorSelection::GetAllSelectedEventsWithoutSubEvents()
{
    std::vector < EventItem > results;
    for (boost::unordered_set< EventItem >::iterator it = eventsSelected.begin();it!=eventsSelected.end();++it)
    {
        bool isAlreadyIncludedAsSubEvent = false;
        for (boost::unordered_set< EventItem >::iterator it2 = eventsSelected.begin();it2!=eventsSelected.end();++it2)
        {
            if ( (*it).event != (*it2).event && (*it2).eventsList != NULL && FindInEventsAndSubEvents(*(*it2).eventsList, (*it).event) )
                isAlreadyIncludedAsSubEvent = true;
        }

        if (!isAlreadyIncludedAsSubEvent)
            results.push_back(*it);
    }

    return results;
}

/**
 * Return a vector with all selected instructions
 */
std::vector < InstructionItem > EventsEditorSelection::GetAllSelectedInstructions()
{
    std::vector < InstructionItem > results;
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
        results.push_back(*it);

    return results;
}

bool EventsEditorSelection::HasSelectedActions()
{
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
        if ( !it->isCondition ) return true;

    return false;
}

bool EventsEditorSelection::HasSelectedConditions()
{
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
        if ( it->isCondition ) return true;

    return false;
}

bool EventsEditorSelection::InstructionSelected(const InstructionItem & instr)
{
    return instructionsSelected.find(instr) != instructionsSelected.end();
}

void EventsEditorSelection::SetHighlighted(const EventItem & eventSelection)
{
    eventHighlighted = eventSelection;
}
void EventsEditorSelection::SetHighlighted(const InstructionItem & instructionSelection)
{
    instructionHighlighted = instructionSelection;
}
void EventsEditorSelection::SetHighlighted(const InstructionListItem & item)
{
    instructionListHighlighted = item;
}
void EventsEditorSelection::SetHighlighted(const ParameterItem & parameterItem)
{
    parameterHighlighted = parameterItem;
}

void EventsEditorSelection::BeginDragEvent()
{
    dragging = true;
}

bool EventsEditorSelection::IsDraggingEvent()
{
    return dragging;
}

bool EventsEditorSelection::EndDragEvent()
{
    if (!dragging) return false;
    dragging = false;

    std::cout << "endDragSTART" << std::endl;

    if ( eventHighlighted.eventsList == NULL ) return false;

    //Be sure we do not try to drag inside an event selected
    for (boost::unordered_set< EventItem >::iterator it = eventsSelected.begin();it!=eventsSelected.end();++it)
    {
        if ( (*it).event == boost::shared_ptr<BaseEvent>() )
        {
            std::cout << "WARNING: Bad event in selection";
            continue;
        }

        if ( (*it).event == eventHighlighted.event || ((*it).event->CanHaveSubEvents() && FindInEventsAndSubEvents((*it).event->GetSubEvents(), eventHighlighted.event)) )
        {
            std::cout << "Cannot drag here" << std::endl;
            return false;
        }
    }

    //Insert dragged events
    for (boost::unordered_set< EventItem >::iterator it = eventsSelected.begin();it!=eventsSelected.end();++it)
    {
        if ( (*it).event != boost::shared_ptr<BaseEvent>() )
        {
            boost::shared_ptr<BaseEvent> newEvent = (*it).event->Clone();
            eventHighlighted.eventsList->insert(eventHighlighted.eventsList->begin()+eventHighlighted.positionInList, newEvent);
        }
    }

    //Remove them from their initial position
    for (boost::unordered_set< EventItem >::iterator it = eventsSelected.begin();it!=eventsSelected.end();++it)
    {
        if ( (*it).event != boost::shared_ptr<BaseEvent>() && (*it).eventsList != NULL)
            (*it).eventsList->erase(std::remove((*it).eventsList->begin(), (*it).eventsList->end(), (*it).event) , (*it).eventsList->end());
    }

    std::cout << "endDragEND" << std::endl;
    ClearSelection();

    return true;
}

void EventsEditorSelection::BeginDragInstruction()
{
    draggingInstruction = true;
}

bool EventsEditorSelection::IsDraggingInstruction()
{
    return draggingInstruction;
}

bool EventsEditorSelection::EndDragInstruction()
{
    if (!draggingInstruction) return false;
    draggingInstruction = false;

    std::cout << "endDragSTART" << std::endl;

    if ( instructionHighlighted.instruction == NULL ) return false;

    if ( instructionHighlighted.event != NULL ) instructionHighlighted.event->eventHeightNeedUpdate = true;
    else std::cout << "WARNING : Instruction hightlighted event is not valid! " << std::endl;

    //Be sure we do not try to drag inside an event selected
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
    {
        if ( (*it).instruction == NULL )
        {
            std::cout << "WARNING: Bad instr in selection";
            continue;
        }

        if ( (*it).instruction == instructionHighlighted.instruction || (FindInInstructionsAndSubInstructions((*it).instruction->GetSubInstructions(), instructionHighlighted.instruction)) )
        {
            std::cout << "Cannot drag here" << std::endl;
            return false;
        }
        if  (FindInInstructionsAndSubInstructions(instructionHighlighted.instruction->GetSubInstructions(), (*it).instruction) )
        {
            std::cout << "Cannot drag here" << std::endl;
            return false;
        }
    }

    //Copy dragged instructions
    std::vector<Instruction> draggedInstructions;
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
    {
        if ( (*it).instruction != NULL )
            draggedInstructions.push_back(*(*it).instruction);
    }

    //Insert dragged instructions into their new list.
    for (unsigned int i = 0;i<draggedInstructions.size();++i)
        instructionHighlighted.instructionList->insert(instructionHighlighted.instructionList->begin()+instructionHighlighted.positionInList, draggedInstructions[i]);


    boost::unordered_set< InstructionItem > newInstructionsSelected;
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
    {
        if ((*it).instructionList == instructionHighlighted.instructionList && (*it).positionInList > instructionHighlighted.positionInList)
        {
            InstructionItem newItem = (*it);
            newItem.instruction = NULL;
            newItem.positionInList += draggedInstructions.size();
            newInstructionsSelected.insert(newItem);
        }
        else newInstructionsSelected.insert(*it);
    }
    instructionsSelected = newInstructionsSelected;

    //Remove dragged instructions
    DeleteAllInstructionSelected();

    std::cout << "endDragEND" << std::endl;
    ClearSelection();

    return true;
}

void EventsEditorSelection::DeleteAllInstructionSelected()
{
    //1) Construct a map with their list and their index in the list
    std::map< std::vector<Instruction>*, std::list<unsigned int> > mapOfDeletionsRequest;
    for (boost::unordered_set< InstructionItem >::iterator it = instructionsSelected.begin();it!=instructionsSelected.end();++it)
    {
        if ( (*it).event != NULL ) (*it).event->eventHeightNeedUpdate = true;
        if ( (*it).instructionList != NULL)
            mapOfDeletionsRequest[(*it).instructionList].push_back((*it).positionInList);
    }
    //2) For each list, erase each index
    for (std::map<std::vector<Instruction>*,std::list<unsigned int> >::iterator it = mapOfDeletionsRequest.begin();it!=mapOfDeletionsRequest.end();++it)
    {
        std::list<unsigned int> & listOfIndexesToDelete = it->second;
        listOfIndexesToDelete.sort();
        listOfIndexesToDelete.reverse(); //We have erase from end to start to prevent index changing

        for (std::list<unsigned int>::iterator index = listOfIndexesToDelete.begin();index!=listOfIndexesToDelete.end();++index)
            it->first->erase(it->first->begin()+*index);
    }
}

EventsEditorSelection::EventsEditorSelection(GDpriv::EventsEditorRefreshCallbacks & eventsEditorCallback_) :
    dragging(false),
    draggingInstruction(false),
    eventsEditorCallback(eventsEditorCallback_)
{
}

bool EventsEditorSelection::FindInEventsAndSubEvents(std::vector<boost::shared_ptr<BaseEvent> > & list, boost::shared_ptr<BaseEvent> eventToSearch)
{
    for (unsigned int i = 0;i<list.size();++i)
    {
        if ( list[i] == eventToSearch) return true;
        if ( list[i]->CanHaveSubEvents() && FindInEventsAndSubEvents(list[i]->GetSubEvents(), eventToSearch) )
            return true;
    }

    return false;
}

bool EventsEditorSelection::FindInInstructionsAndSubInstructions(std::vector<Instruction> & list, const Instruction * instrToSearch)
{
    for (unsigned int i = 0;i<list.size();++i)
    {
        if ( &list[i] == instrToSearch) return true;
        if ( FindInInstructionsAndSubInstructions(list[i].GetSubInstructions(), instrToSearch) )
            return true;
    }

    return false;
}

#endif
