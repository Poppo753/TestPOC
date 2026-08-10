import { combineControllers, type DisposableController } from '../../core/disposable';
import { mountDecisionRunway } from './decision-runway/controller';
import { mountFinancialSynthesis } from './financial-synthesis/controller';
import { mountReceiptAllocation } from './receipt-allocation/controller';
import { mountRoadmapStrip } from './roadmap-strip/controller';
import { mountArchitectureMap } from './architecture-map/controller';
import { mountStrategyInspector } from './strategy-inspector/controller';
import { mountOwnershipMotion } from './ownership/motion-controller';
import { mountVaultExplorer } from './ownership/vault-controller';
import { mountWalletAllocation } from './ownership/wallet-allocation';

export function mountSimpleHomeFeatures(root: ParentNode = document): DisposableController {
  const controllers: DisposableController[] = [];
  const roadmap = root.querySelector<HTMLElement>('.product-horizons');
  if (roadmap) controllers.push(mountRoadmapStrip(roadmap));
  for (const component of root.querySelectorAll<HTMLElement>('[data-receipt-allocation-chart]')) {
    controllers.push(mountReceiptAllocation(component));
  }
  for (const section of root.querySelectorAll<HTMLElement>('[data-financial-synthesis]')) {
    controllers.push(mountFinancialSynthesis(section));
  }
  for (const runway of root.querySelectorAll<HTMLElement>('[data-decision-runway]')) {
    controllers.push(mountDecisionRunway(runway));
  }
  for (const inspector of root.querySelectorAll<HTMLElement>('[data-strategy-inspector]')) {
    controllers.push(mountStrategyInspector(inspector));
  }
  for (const architecture of root.querySelectorAll<HTMLElement>('[data-architecture-map]')) {
    controllers.push(mountArchitectureMap(architecture));
  }
  for (const preview of root.querySelectorAll<HTMLElement>('[data-wallet-allocation]')) {
    controllers.push(mountWalletAllocation(preview));
  }
  for (const journey of root.querySelectorAll<HTMLElement>('[data-ownership-journey]')) {
    controllers.push(
      mountOwnershipMotion(journey, root.querySelector<HTMLElement>('[data-ownership-source]')),
      mountVaultExplorer(journey),
    );
  }
  return combineControllers(controllers);
}
