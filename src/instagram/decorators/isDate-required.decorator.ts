import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function generateMessage(args: ValidationArguments): string {
  const value = args.value;

  if (!value) {
    return 'scheduledPublishDate is required when publishImmediately is false';
  }

  if (!(value instanceof Date) || isNaN(value.getTime())) {
    return 'scheduledPublishDate must be a valid Date';
  }

  const minutes = value.getMinutes();
  if (minutes !== 0 && minutes !== 30) {
    return 'scheduledPublishDate must be on the hour or half hour';
  }

  return 'scheduledPublishDate is not valid';
}

export function IsDateRequiredDecorator(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDateRequired',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: Object.assign({}, validationOptions, {
        message: generateMessage,
      }),
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          if (relatedValue === false) {
            return (
              value instanceof Date &&
              !isNaN(value.getTime()) &&
              (value.getMinutes() === 0 || value.getMinutes() === 30)
            );
          }
          return true;
        },
      },
    });
  };
}
