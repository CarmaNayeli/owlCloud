import STORAGE_LIMITS from '/imports/constants/STORAGE_LIMITS';
import { InferType, TypedSimpleSchema } from '/imports/api/utility/TypedSimpleSchema';
import { Simplify } from 'type-fest';

const ErrorSchema = TypedSimpleSchema.from({
  message: {
    type: String,
    max: STORAGE_LIMITS.errorMessage,
  },
  type: {
    type: String,
    max: STORAGE_LIMITS.name,
  },
});

export type ErrorSchemaType = Simplify<InferType<typeof ErrorSchema>>;

export default ErrorSchema;
