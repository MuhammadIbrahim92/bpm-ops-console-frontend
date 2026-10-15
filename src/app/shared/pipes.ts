import { Pipe, PipeTransform } from '@angular/core';
import { formatAge, formatDateTime, formatDuration } from '../core/format';

@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    return formatDuration(seconds);
  }
}

@Pipe({ name: 'dateTime', standalone: true })
export class DateTimePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}

@Pipe({ name: 'age', standalone: true })
export class AgePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return formatAge(iso);
  }
}
