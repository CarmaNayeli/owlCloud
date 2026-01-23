import { EngineAction } from '/imports/api/engine/action/EngineActions';
import { applyDefaultAfterPropTasks } from '/imports/api/engine/action/functions/applyTaskGroups';
import { PropTask } from '/imports/api/engine/action/tasks/Task';


export default async function applyFolderProperty(
  task: PropTask, action: EngineAction, result, userInput
): Promise<void> {
  const prop = task.prop;

  if (prop.type !== 'folder' && prop.type !== 'propertySlot') {
    throw new Meteor.Error('wrong-property', `Expected a folder, got ${prop.type} instead`);
  }

  return applyDefaultAfterPropTasks(action, prop, task.targetIds, userInput);
}
