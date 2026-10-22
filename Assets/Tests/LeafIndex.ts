/**
 * LeafIndex: registers the Keep Pace LEAF scenarios (one or two per done criterion of
 * devpost/design-brief.md). Attached to the root "LeafIndex" SceneObject.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {KeepPaceFadingScenario} from "./KeepPaceFadingScenario"
import {KeepPaceTargetLockScenario} from "./KeepPaceTargetLockScenario"
import {KeepPaceEarlyEndScenario} from "./KeepPaceEarlyEndScenario"
import {KeepPaceSummaryViewScenario} from "./KeepPaceSummaryViewScenario"
import {KeepPaceSummaryStatsScenario} from "./KeepPaceSummaryStatsScenario"
import {KeepPaceAgainMoveScenario} from "./KeepPaceAgainMoveScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-fading", typename: KeepPaceFadingScenario.getTypeName()},
    {id: "c2-target-lock", typename: KeepPaceTargetLockScenario.getTypeName()},
    {id: "c3-early-end", typename: KeepPaceEarlyEndScenario.getTypeName()},
    {id: "c3-summary-view-geometry", typename: KeepPaceSummaryViewScenario.getTypeName()},
    {id: "c4-faithful-summary", typename: KeepPaceSummaryStatsScenario.getTypeName()},
    {id: "c5-again-move-target", typename: KeepPaceAgainMoveScenario.getTypeName()},
  ]
}
