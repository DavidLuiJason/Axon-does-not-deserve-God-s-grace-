/** Explicit metadata registration for every tool engine descriptor present in this base. */
import { registerCapability } from './registry';
import type { Capability, ChatActionInput } from './types';
import { LEGACY_ENGINE_DESCRIPTORS } from '../tools/engines/legacyDescriptors';
import { QR_DESCRIPTOR } from '../tools/engines/create/qrCode';
import { PATTERN_TEST_DESCRIPTOR } from '../tools/engines/code/patternTest';
import { CODE_FORMAT_DESCRIPTOR } from '../tools/engines/code/codeFormat';
import { CSV_DESCRIPTOR } from '../tools/engines/data/csv';
import { JSON_TOKENS_DESCRIPTOR } from '../tools/engines/data/jsonTokens';
import { JSON_VIEW_DESCRIPTOR } from '../tools/engines/data/jsonView';
import { XML_DESCRIPTOR } from '../tools/engines/data/xml';
import { YAML_DESCRIPTOR } from '../tools/engines/data/yaml';
import { DEVICE_PROFILE_DESCRIPTOR } from '../tools/engines/device/deviceProfile';
import { FILE_COMPARE_DESCRIPTOR } from '../tools/engines/files/fileCompare';
import { FILE_INSPECT_DESCRIPTOR } from '../tools/engines/files/inspect';
import { ZIP_TOOL_DESCRIPTOR } from '../tools/engines/files/zipTool';
import { LOAN_DESCRIPTOR } from '../tools/engines/finance/loan';
import { SPLIT_TIP_DESCRIPTOR } from '../tools/engines/finance/splitTip';
import { IMAGE_CONVERT_DESCRIPTOR } from '../tools/engines/images/convertPlan';
import { HTML_TEXT_DESCRIPTOR } from '../tools/engines/text/htmlText';
import { MARKDOWN_DESCRIPTOR } from '../tools/engines/text/markdown';
import { SUMMARIZER_DESCRIPTOR } from '../tools/engines/text/summarize';
import { DOCUMENT_READER_DESCRIPTOR } from '../tools/engines/files/documentRead';
import { FILE_CONVERTER_DESCRIPTOR } from '../tools/engines/files/fileConvertPlan';
import { BATCH_CONVERT_DESCRIPTOR } from '../tools/engines/files/batchPlan';
import { MY_DICTIONARY_DESCRIPTOR } from '../tools/engines/dictionary/userDictionary';
import { TEXT_FORMATS_DESCRIPTOR } from '../tools/engines/text/textFormats';
import { VIDEO_FRAMES_DESCRIPTOR } from '../tools/engines/video/framePlan';
import { COLLAGE_DESCRIPTOR } from '../tools/engines/images/collagePlan';
import { PICTURE_TO_TABLE_DESCRIPTOR } from '../tools/engines/images/tableFromBoxes';

export const ENGINE_DESCRIPTORS = [
  ...LEGACY_ENGINE_DESCRIPTORS,
  QR_DESCRIPTOR, PATTERN_TEST_DESCRIPTOR, CODE_FORMAT_DESCRIPTOR,
  CSV_DESCRIPTOR, JSON_TOKENS_DESCRIPTOR, JSON_VIEW_DESCRIPTOR, XML_DESCRIPTOR, YAML_DESCRIPTOR,
  DEVICE_PROFILE_DESCRIPTOR, FILE_COMPARE_DESCRIPTOR, FILE_INSPECT_DESCRIPTOR, ZIP_TOOL_DESCRIPTOR,
  LOAN_DESCRIPTOR, SPLIT_TIP_DESCRIPTOR, IMAGE_CONVERT_DESCRIPTOR,
  HTML_TEXT_DESCRIPTOR, MARKDOWN_DESCRIPTOR, TEXT_FORMATS_DESCRIPTOR,
  SUMMARIZER_DESCRIPTOR, DOCUMENT_READER_DESCRIPTOR, FILE_CONVERTER_DESCRIPTOR, BATCH_CONVERT_DESCRIPTOR, MY_DICTIONARY_DESCRIPTOR,
  VIDEO_FRAMES_DESCRIPTOR,
  COLLAGE_DESCRIPTOR, PICTURE_TO_TABLE_DESCRIPTOR,
] as const;

const NOT_BUILT_NOTE = 'Opens from the Tools menu once its screen exists; chat control arrives with the brain.';
type Descriptor = { toolId: string; displayName: string; purpose: string; examples: readonly string[]; inputs: readonly { name: string; kind: 'text' | 'choice' | 'file' | 'yes-no'; choices?: readonly string[]; prompt?: string }[] };

function groupsByToolId(): Map<string, Descriptor[]> {
  const grouped = new Map<string, Descriptor[]>();
  for (const raw of ENGINE_DESCRIPTORS as readonly Descriptor[]) {
    const group = grouped.get(raw.toolId) ?? [];
    group.push(raw);
    grouped.set(raw.toolId, group);
  }
  return grouped;
}

/** Register each descriptor-backed catalog tool once; converter formats share one action. */
export function registerEngineTools(): void {
  for (const [toolId, descriptors] of groupsByToolId()) {
    const examples = [...new Set(descriptors.flatMap((descriptor) => [...descriptor.examples]))].slice(0, 3);
    const inputMap = new Map<string, ChatActionInput>();
    for (const descriptor of descriptors) for (const input of descriptor.inputs) {
      if (!inputMap.has(input.name)) inputMap.set(input.name, { name: input.name, kind: input.kind, ...(input.prompt ? { prompt: input.prompt } : {}), ...(input.choices ? { choices: [...input.choices] } : {}) });
    }
    const displayName = toolId === 'converter' ? 'Converter formats' : descriptors[0].displayName;
    const purpose = toolId === 'converter'
      ? 'Use the implemented text, data and image-format engines for bounded conversions and safe parsing; supported formats and limits depend on the selected format.'
      : toolId === 'json-viewer'
        ? 'Inspect JSON structure and validate, indent or minify JSON without changing number literals or duplicate keys.'
        : descriptors[0].purpose;
    const capability: Capability = {
      id: `cap.engine-tools.${toolId}`,
      displayName: `${displayName} Engine`,
      contractVersion: '1.0.0',
      implementationVersion: '1.0.0',
      chatActions: [{
        id: `act.engine.${toolId}`,
        purpose,
        examples: examples.length >= 2 ? examples : [...examples, `Use ${displayName} with valid input`],
        status: 'not-built',
        inputs: [...inputMap.values()],
        note: NOT_BUILT_NOTE,
      }],
    };
    registerCapability(capability);
  }
}
