/*
 * 2011 Peter 'Pita' Martischka
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var empty_frame = '---------------------------------------------';
function ERR(err, callback, asyncStackLines)
{
  //there is a error
  if(err != null)
  {
    // determine the new stacktrace line
    if (!asyncStackLines) {
      asyncStackLines = new Error().stack.split("\n").slice(2);
      asyncStackLines.unshift(empty_frame);
    }

    //if only the callback function is passed
    if(typeof err == "function")
    {
      //wrap callback so ERR() is eventually called w/ the cached stacktrace line
      callback = err;
      return function(err) {
        if (err) {
          err.stack += '\n' + empty_frame + '\n' + asyncStackLines[1];
          return callback(err);
        }
        callback.apply(this, arguments);
      };
    }
    //if there is already a stacktrace avaiable
    else if(err.stack != null)
    {
      //join the new stacktrace
      err.stack += '\n' + asyncStackLines.join('\n')
    }
    //no stacktrace, so lets create an error out of this object
    else
    {
      err = new Error(err);
    }
  
    //if a callback is passed, lets call it
    if(callback != null)
    {
      callback(err);
    }
  }
  
  return err;
}

module.exports = ERR;
