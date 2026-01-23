import TaskResult, { LogContent } from '../tasks/TaskResult';
import { EngineAction } from '/imports/api/engine/action/EngineActions';
import { applyDefaultAfterPropTasks } from '/imports/api/engine/action/functions/applyTaskGroups';
import recalculateInlineCalculations from '/imports/api/engine/action/functions/recalculateInlineCalculations';
import { PropTask } from '/imports/api/engine/action/tasks/Task';
import getPropertyTitle from '/imports/api/utility/getPropertyTitle';

export default async function applyTriggerProperty(
  task: PropTask, action: EngineAction, result: TaskResult, userInput
): Promise<void> {
  const prop = task.prop;

  if (prop.type !== 'trigger') {
    throw new Meteor.Error('wrong-property', `Expected a trigger, got ${prop.type} instead`);
  }

  const logContent: LogContent & { silenced: boolean | undefined } = {
    name: getPropertyTitle(prop),
    silenced: prop.silent,
  }

  // Add the trigger description to the log
  if (prop.description?.text) {
    await recalculateInlineCalculations(prop.description, action, 'reduce', userInput);
    if (prop.description.value) {
      logContent.value = prop.description.value;
    }
  }

  result.appendLog(logContent, task.targetIds);
  return applyDefaultAfterPropTasks(action, prop, task.targetIds, userInput);
}
