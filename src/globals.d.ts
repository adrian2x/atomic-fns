/**
 * Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

interface ErrorConstructor {
  /** See https://v8.dev/docs/stack-trace-api#stack-trace-collection-for-custom-exceptions. */
  // eslint-disable-next-line @typescript-eslint/ban-types
  captureStackTrace(error: Object, constructor?: Function): void
}
